// Campaign runner for match-based email nudges.
//
// Flow per recipient: preference check -> Clerk email -> Mongo profile ->
// selectJobsForUser (pure) -> renderNudgeEmail (pure) -> NudgeSend row
// (queued) -> provider batch (<=100) -> row updated to sent/dry_run/failed.
// The (campaignId, userId) unique index makes a re-run or retry safe.

import { randomUUID } from "crypto";
import { waitUntil } from "@vercel/functions";
import type { Campaign, CampaignVariant, EmailPreference, Prisma } from "@prisma/client";
import { fetchClerkUsers, type ClerkUserInfo } from "./clerk-users.js";
import { createEmailProvider, EMAIL_BATCH_SIZE, listUnsubscribeHeaders, type EmailProvider, type OutgoingEmail } from "./email.js";
import { newUnsubscribeToken, signUnsubscribeToken } from "./email-tokens.js";
import { activeJobWhere } from "./job-expiry.js";
import { getProfilesCollection } from "./mongo.js";
import { renderNudgeEmail, siteLink, type RenderedEmail } from "./nudge-render.js";
import { DEFAULT_NUDGE_JOB_COUNT, selectJobsForUser, type NudgeJobInput, type RankedJob } from "./nudge-select.js";
import { assignVariant, bucketFor } from "./nudge-variants.js";
import { prisma } from "./prisma.js";
import { backendUrl, contactEmail, frontendUrl } from "./site-urls.js";

export const SCHEDULE_PAUSED_KEY = "nudges.schedule_paused";
export const DEFAULT_NUDGE_BUDGET_MS = 240_000;
export const RECIPIENT_PAGE_SIZE = EMAIL_BATCH_SIZE;

/** Send statuses that count as an email the user has already received. */
export const DELIVERED_LIKE_STATUSES = ["queued", "dry_run", "sent", "delivered", "bounced", "complained"] as const;

// ─── Profiles (Mongo) ────────────────────────────────────────────────────────

export interface NudgeProfile {
  userId: string;
  name: string | null;
  filterSummary: { roleFamily: string; seniority: string; remoteMode: string; stack: string[] };
  createdAt: Date | null;
}

interface ProfileDocLite {
  _id: string;
  contact?: { name?: string };
  filterSummary?: { roleFamily?: string; seniority?: string; remoteMode?: string; stack?: string[] };
  createdAt?: Date;
}

function toNudgeProfile(doc: ProfileDocLite): NudgeProfile | null {
  const fs = doc.filterSummary;
  if (!fs) return null;
  return {
    userId: String(doc._id),
    name: doc.contact?.name?.trim() || null,
    filterSummary: {
      roleFamily: fs.roleFamily ?? "",
      seniority: fs.seniority ?? "",
      remoteMode: fs.remoteMode ?? "",
      stack: Array.isArray(fs.stack) ? fs.stack : [],
    },
    createdAt: doc.createdAt ?? null,
  };
}

/** Every user with a resume profile, in a stable order. */
export async function listEligibleUserIds(): Promise<string[]> {
  const collection = await getProfilesCollection();
  if (!collection) return [];
  const docs = await collection
    .find({ filterSummary: { $exists: true } }, { projection: { _id: 1 } })
    .sort({ _id: 1 })
    .toArray();
  return docs.map((d) => String(d._id));
}

export async function loadProfiles(userIds: string[]): Promise<Map<string, NudgeProfile>> {
  const result = new Map<string, NudgeProfile>();
  if (userIds.length === 0) return result;
  const collection = await getProfilesCollection();
  if (!collection) return result;
  const docs = (await collection
    .find({ _id: { $in: userIds } } as never, { projection: { _id: 1, contact: 1, filterSummary: 1, createdAt: 1 } })
    .toArray()) as unknown as ProfileDocLite[];
  for (const doc of docs) {
    const profile = toNudgeProfile(doc);
    if (profile) result.set(profile.userId, profile);
  }
  return result;
}

// ─── Preferences ─────────────────────────────────────────────────────────────

/** Default row for a user who never touched the toggle: subscribed, weekly. */
export async function ensurePreferences(userIds: string[]): Promise<Map<string, EmailPreference>> {
  const result = new Map<string, EmailPreference>();
  if (userIds.length === 0) return result;
  const existing = await prisma.emailPreference.findMany({ where: { userId: { in: userIds } } });
  for (const pref of existing) result.set(pref.userId, pref);
  const missing = userIds.filter((id) => !result.has(id));
  if (missing.length > 0) {
    await prisma.emailPreference.createMany({
      data: missing.map((userId) => ({ userId, unsubscribeToken: newUnsubscribeToken() })),
      skipDuplicates: true,
    });
    const created = await prisma.emailPreference.findMany({ where: { userId: { in: missing } } });
    for (const pref of created) result.set(pref.userId, pref);
  }
  return result;
}

export async function getOrCreatePreference(userId: string): Promise<EmailPreference> {
  const prefs = await ensurePreferences([userId]);
  const pref = prefs.get(userId);
  if (!pref) throw new Error(`preference row missing for ${userId}`);
  return pref;
}

/** Should this campaign email this user right now? Pure. */
export function isRecipientActive(
  pref: Pick<EmailPreference, "subscribed" | "frequency" | "pausedUntil">,
  campaignKind: Campaign["kind"],
  now: Date,
): boolean {
  if (!pref.subscribed) return false;
  if (pref.pausedUntil && pref.pausedUntil.getTime() > now.getTime()) return false;
  if (campaignKind === "daily" && pref.frequency !== "daily") return false;
  return true;
}

// ─── URLs ────────────────────────────────────────────────────────────────────

export function unsubscribePageUrl(pref: Pick<EmailPreference, "unsubscribeToken">, env = process.env): string {
  return `${frontendUrl(env)}/unsubscribe?t=${encodeURIComponent(signUnsubscribeToken(pref.unsubscribeToken, env))}`;
}

/** Endpoint mail clients POST to for RFC 8058 one-click unsubscribe. */
export function unsubscribeApiUrl(pref: Pick<EmailPreference, "unsubscribeToken">, env = process.env): string {
  return `${backendUrl(env)}/api/email/unsubscribe?t=${encodeURIComponent(signUnsubscribeToken(pref.unsubscribeToken, env))}`;
}

// ─── Job pool ────────────────────────────────────────────────────────────────

export async function loadJobPool(now = new Date()): Promise<NudgeJobInput[]> {
  const jobs = await prisma.job.findMany({
    where: activeJobWhere(now),
    select: {
      id: true,
      title: true,
      company: true,
      author: true,
      authorTitle: true,
      source: true,
      sourceUrl: true,
      roleFamily: true,
      seniority: true,
      remoteMode: true,
      stack: true,
      description: true,
      rawText: true,
      postedAt: true,
      createdAt: true,
    },
  });
  return jobs.map((j) => ({ ...j, stack: j.stack as string[] }));
}

/** Jobs already emailed per user, and when they last got a nudge. */
export async function loadSendHistory(
  userIds: string[],
): Promise<Map<string, { jobIds: Set<number>; lastSentAt: Date | null }>> {
  const result = new Map<string, { jobIds: Set<number>; lastSentAt: Date | null }>();
  if (userIds.length === 0) return result;
  const rows = await prisma.nudgeSend.findMany({
    where: { userId: { in: userIds }, status: { in: [...DELIVERED_LIKE_STATUSES] } },
    select: { userId: true, jobIds: true, sentAt: true, createdAt: true },
  });
  for (const row of rows) {
    const entry = result.get(row.userId) ?? { jobIds: new Set<number>(), lastSentAt: null };
    for (const id of row.jobIds) entry.jobIds.add(id);
    const at = row.sentAt ?? row.createdAt;
    if (!entry.lastSentAt || at.getTime() > entry.lastSentAt.getTime()) entry.lastSentAt = at;
    result.set(row.userId, entry);
  }
  return result;
}

// ─── Build one nudge ─────────────────────────────────────────────────────────

export interface BuiltNudge {
  rendered: RenderedEmail;
  picks: RankedJob[];
  poolSize: number;
  email: OutgoingEmail;
}

export function buildNudge(options: {
  sendId: string;
  campaign: Pick<Campaign, "key" | "jobCount">;
  variant: Pick<CampaignVariant, "subject" | "intro" | "jobCount"> | null;
  profile: NudgeProfile;
  recipient: ClerkUserInfo & { email: string };
  pref: Pick<EmailPreference, "unsubscribeToken">;
  jobs: NudgeJobInput[];
  excludeJobIds: Iterable<number>;
  sinceCreatedAt: Date | null;
  now: Date;
  env?: NodeJS.ProcessEnv;
}): BuiltNudge | null {
  const env = options.env ?? process.env;
  const limit = options.variant?.jobCount ?? options.campaign.jobCount ?? DEFAULT_NUDGE_JOB_COUNT;
  const selection = selectJobsForUser({
    jobs: options.jobs,
    profile: options.profile.filterSummary,
    excludeJobIds: options.excludeJobIds,
    sinceCreatedAt: options.sinceCreatedAt,
    limit,
    now: options.now,
    env,
  });
  if (selection.picks.length === 0) return null;

  const site = frontendUrl(env);
  const unsubscribeUrl = unsubscribePageUrl(options.pref, env);
  const rendered = renderNudgeEmail({
    recipientName: options.recipient.firstName ?? options.profile.name?.split(/\s+/)[0] ?? null,
    jobs: selection.picks,
    sendId: options.sendId,
    campaignKey: options.campaign.key,
    siteUrl: site,
    unsubscribeUrl,
    preferencesUrl: siteLink(site, "/profile", options.campaign.key, "preferences") + "#email",
    subjectTemplate: options.variant?.subject ?? null,
    intro: options.variant?.intro ?? null,
    contactEmail: contactEmail(env),
  });

  return {
    rendered,
    picks: selection.picks,
    poolSize: selection.poolSize,
    email: {
      to: options.recipient.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      headers: listUnsubscribeHeaders(unsubscribeApiUrl(options.pref, env)),
      tags: [{ name: "campaign", value: options.campaign.key.replace(/[^a-zA-Z0-9_-]/g, "_") }],
    },
  };
}

// ─── Schedule ────────────────────────────────────────────────────────────────

export async function isSchedulePaused(): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: SCHEDULE_PAUSED_KEY } });
  return row?.value === "true";
}

export async function setSchedulePaused(paused: boolean): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: SCHEDULE_PAUSED_KEY },
    update: { value: String(paused) },
    create: { key: SCHEDULE_PAUSED_KEY, value: String(paused) },
  });
}

/** ISO week key, e.g. 2026-W40 (UTC). */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** The campaign the daily cron should run today: weekly on Mondays, daily otherwise. Pure. */
export function scheduledCampaignFor(now: Date): { key: string; name: string; kind: "weekly" | "daily" } {
  if (now.getUTCDay() === 1) {
    const week = isoWeekKey(now);
    return { key: `weekly-${week}`, name: `Weekly matches ${week}`, kind: "weekly" };
  }
  const day = now.toISOString().slice(0, 10);
  return { key: `daily-${day}`, name: `Daily matches ${day}`, kind: "daily" };
}

/**
 * Create (or fetch) today's scheduled campaign. Returns null when the
 * schedule is paused, or on a non-Monday when nobody chose daily emails.
 */
export async function ensureScheduledCampaign(now = new Date()): Promise<Campaign | null> {
  if (await isSchedulePaused()) return null;
  const spec = scheduledCampaignFor(now);
  if (spec.kind === "daily") {
    const dailyCount = await prisma.emailPreference.count({ where: { frequency: "daily", subscribed: true } });
    if (dailyCount === 0) return null;
  }
  const existing = await prisma.campaign.findUnique({ where: { key: spec.key } });
  if (existing) return existing;
  return prisma.campaign.create({
    data: { key: spec.key, name: spec.name, kind: spec.kind, createdBy: "cron", jobCount: DEFAULT_NUDGE_JOB_COUNT },
  });
}

export async function createManualCampaign(createdBy: string, now = new Date()): Promise<Campaign> {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return prisma.campaign.create({
    data: {
      key: `manual-${stamp}`,
      name: `Manual send ${now.toISOString().slice(0, 16).replace("T", " ")} UTC`,
      kind: "manual",
      createdBy,
      jobCount: DEFAULT_NUDGE_JOB_COUNT,
    },
  });
}

// ─── Run ─────────────────────────────────────────────────────────────────────

export interface RunCampaignOptions {
  campaignId: number;
  budgetMs?: number;
  now?: Date;
  env?: NodeJS.ProcessEnv;
  provider?: EmailProvider;
  pageSize?: number;
}

export interface RunCampaignResult {
  campaignId: number;
  campaignKey: string;
  dryRun: boolean;
  candidates: number;
  processed: number;
  sent: number;
  skipped: number;
  holdout: number;
  failed: number;
  inactive: number;
  remaining: number;
  exhaustedBudget: boolean;
  completed: boolean;
}

export async function runCampaign(options: RunCampaignOptions): Promise<RunCampaignResult> {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const provider = options.provider ?? createEmailProvider(env);
  const budgetMs = options.budgetMs ?? Number(env.NUDGE_BUDGET_MS ?? DEFAULT_NUDGE_BUDGET_MS);
  const pageSize = Math.min(options.pageSize ?? RECIPIENT_PAGE_SIZE, EMAIL_BATCH_SIZE);
  const startedAt = Date.now();

  const campaign = await prisma.campaign.findUnique({
    where: { id: options.campaignId },
    include: { variants: true },
  });
  if (!campaign) throw new Error(`campaign ${options.campaignId} not found`);

  const result: RunCampaignResult = {
    campaignId: campaign.id,
    campaignKey: campaign.key,
    dryRun: provider.dryRun,
    candidates: 0,
    processed: 0,
    sent: 0,
    skipped: 0,
    holdout: 0,
    failed: 0,
    inactive: 0,
    remaining: 0,
    exhaustedBudget: false,
    completed: campaign.status === "completed",
  };
  if (campaign.status === "completed") return result;

  if (campaign.status !== "running") {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "running", startedAt: now } });
  }

  const candidateIds = await listEligibleUserIds();
  const already = new Set(
    (await prisma.nudgeSend.findMany({ where: { campaignId: campaign.id }, select: { userId: true } })).map((r) => r.userId),
  );
  const todo = candidateIds.filter((id) => !already.has(id));
  result.candidates = todo.length;

  const variants = [...campaign.variants].sort((a, b) => a.id - b.id);
  const jobs = await loadJobPool(now);

  let index = 0;
  while (index < todo.length) {
    const page = todo.slice(index, index + pageSize);
    index += page.length;

    const prefs = await ensurePreferences(page);
    const activeIds = page.filter((id) => {
      const pref = prefs.get(id);
      return pref ? isRecipientActive(pref, campaign.kind, now) : false;
    });
    result.inactive += page.length - activeIds.length;

    const [clerkUsers, profiles, history] = await Promise.all([
      fetchClerkUsers(activeIds, env),
      loadProfiles(activeIds),
      loadSendHistory(activeIds),
    ]);

    const rows: Prisma.NudgeSendCreateManyInput[] = [];
    const outgoing: { row: Prisma.NudgeSendCreateManyInput; email: OutgoingEmail; pref: EmailPreference }[] = [];

    for (const userId of activeIds) {
      const pref = prefs.get(userId)!;
      const profile = profiles.get(userId);
      const clerk = clerkUsers.get(userId);
      const variant = variants.length > 0 ? assignVariant(variants, bucketFor(campaign.id, userId)) : null;
      const base = {
        id: randomUUID(),
        campaignId: campaign.id,
        variantId: variant?.id ?? null,
        userId,
        email: clerk?.email ?? pref.email ?? "",
        jobIds: [] as number[],
      };

      if (variant?.isHoldout) {
        rows.push({ ...base, status: "holdout" });
        result.holdout += 1;
        continue;
      }
      if (!clerk?.email) {
        rows.push({ ...base, status: "failed", error: "no Clerk email" });
        result.failed += 1;
        continue;
      }
      if (!profile) {
        rows.push({ ...base, status: "failed", error: "no resume profile" });
        result.failed += 1;
        continue;
      }

      const past = history.get(userId);
      const built = buildNudge({
        sendId: base.id,
        campaign,
        variant,
        profile,
        recipient: { ...clerk, email: clerk.email },
        pref,
        jobs,
        excludeJobIds: past?.jobIds ?? [],
        sinceCreatedAt: past?.lastSentAt ?? null,
        now,
        env,
      });
      if (!built) {
        rows.push({ ...base, status: "skipped" });
        result.skipped += 1;
        continue;
      }
      const row: Prisma.NudgeSendCreateManyInput = {
        ...base,
        status: "queued",
        jobIds: built.picks.map((j) => j.id),
        subject: built.rendered.subject,
      };
      rows.push(row);
      outgoing.push({ row, email: built.email, pref });
    }

    if (rows.length > 0) {
      await prisma.nudgeSend.createMany({ data: rows, skipDuplicates: true });
    }

    if (outgoing.length > 0) {
      const batch = await provider.sendBatch(outgoing.map((o) => o.email));
      const sentAt = new Date();
      await Promise.all(
        outgoing.map(async (o, i) => {
          const id = o.row.id as string;
          if (!batch.ok) {
            result.failed += 1;
            await prisma.nudgeSend.update({
              where: { id },
              data: { status: "failed", error: (batch.error ?? "provider error").slice(0, 500) },
            });
            return;
          }
          result.sent += 1;
          await prisma.nudgeSend.update({
            where: { id },
            data: {
              status: batch.dryRun ? "dry_run" : "sent",
              providerMessageId: batch.ids[i] ?? null,
              sentAt,
            },
          });
          await prisma.emailPreference.update({
            where: { userId: o.row.userId },
            data: { lastSentAt: sentAt, email: o.email.to },
          });
        }),
      );
    }

    result.processed += page.length;

    if (index < todo.length && Date.now() - startedAt >= budgetMs) {
      result.exhaustedBudget = true;
      break;
    }
  }

  result.remaining = todo.length - result.processed;
  if (result.remaining === 0) {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "completed", completedAt: new Date() } });
    result.completed = true;
  }
  return result;
}

/** Fire a self-call so a long campaign continues in a fresh invocation. */
export function continueCampaignLater(campaignId: number, env: NodeJS.ProcessEnv = process.env): void {
  const secret = env.CRON_SECRET;
  if (!secret) {
    console.error("[nudges] CRON_SECRET not set; cannot continue campaign", campaignId);
    return;
  }
  const url = `${backendUrl(env)}/api/cron/nudges?campaign=${campaignId}`;
  waitUntil(
    fetch(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      })
      .catch((err) => {
        console.error(`[nudges] continue failed: ${err instanceof Error ? err.message : err}`);
      }),
  );
}

// ─── Preview and test ────────────────────────────────────────────────────────

export interface PreviewResult {
  userId: string;
  email: string | null;
  name: string | null;
  campaign: { id: number | null; key: string; name: string };
  variant: { id: number; key: string; name: string; isHoldout: boolean } | null;
  rendered: RenderedEmail | null;
  picks: RankedJob[];
  poolSize: number;
  reason: string | null;
}

export async function previewNudgeForUser(options: {
  userId: string;
  campaignId?: number | null;
  variantId?: number | null;
  now?: Date;
  env?: NodeJS.ProcessEnv;
}): Promise<PreviewResult> {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();

  const campaign = options.campaignId
    ? await prisma.campaign.findUnique({ where: { id: options.campaignId }, include: { variants: true } })
    : null;
  const campaignSpec = campaign
    ? { id: campaign.id, key: campaign.key, name: campaign.name, jobCount: campaign.jobCount }
    : { id: null, key: `preview-${scheduledCampaignFor(now).key}`, name: "Preview", jobCount: DEFAULT_NUDGE_JOB_COUNT };
  let variant: CampaignVariant | null = null;
  if (campaign && campaign.variants.length > 0) {
    variant =
      (options.variantId ? campaign.variants.find((v) => v.id === options.variantId) : null) ??
      assignVariant([...campaign.variants].sort((a, b) => a.id - b.id), bucketFor(campaign.id, options.userId));
  }

  const [pref, clerkUsers, profiles, history, jobs] = await Promise.all([
    getOrCreatePreference(options.userId),
    fetchClerkUsers([options.userId], env),
    loadProfiles([options.userId]),
    loadSendHistory([options.userId]),
    loadJobPool(now),
  ]);
  const clerk = clerkUsers.get(options.userId) ?? { userId: options.userId, email: null, firstName: null };
  const profile = profiles.get(options.userId);

  const base: PreviewResult = {
    userId: options.userId,
    email: clerk.email,
    name: clerk.firstName ?? profile?.name ?? null,
    campaign: { id: campaignSpec.id, key: campaignSpec.key, name: campaignSpec.name },
    variant: variant ? { id: variant.id, key: variant.key, name: variant.name, isHoldout: variant.isHoldout } : null,
    rendered: null,
    picks: [],
    poolSize: 0,
    reason: null,
  };
  if (!profile) return { ...base, reason: "no resume profile" };
  if (variant?.isHoldout) return { ...base, reason: "holdout arm: this user would receive nothing" };

  const past = history.get(options.userId);
  const built = buildNudge({
    sendId: "preview",
    campaign: campaignSpec,
    variant,
    profile,
    recipient: { ...clerk, email: clerk.email ?? "preview@example.com" },
    pref,
    jobs,
    excludeJobIds: past?.jobIds ?? [],
    sinceCreatedAt: past?.lastSentAt ?? null,
    now,
    env,
  });
  if (!built) return { ...base, reason: "no qualifying jobs: this user would be skipped" };
  return { ...base, rendered: built.rendered, picks: built.picks, poolSize: built.poolSize };
}

export async function sendTestNudge(options: {
  to: string;
  userId: string;
  campaignId?: number | null;
  variantId?: number | null;
  env?: NodeJS.ProcessEnv;
  provider?: EmailProvider;
}): Promise<{ ok: boolean; dryRun: boolean; providerMessageId: string | null; error?: string; subject?: string }> {
  const env = options.env ?? process.env;
  const provider = options.provider ?? createEmailProvider(env);
  const preview = await previewNudgeForUser({ ...options, env });
  if (!preview.rendered) {
    return { ok: false, dryRun: provider.dryRun, providerMessageId: null, error: preview.reason ?? "nothing to send" };
  }
  const pref = await getOrCreatePreference(options.userId);
  const email: OutgoingEmail = {
    to: options.to,
    subject: `[TEST] ${preview.rendered.subject}`,
    html: preview.rendered.html,
    text: preview.rendered.text,
    headers: listUnsubscribeHeaders(unsubscribeApiUrl(pref, env)),
    tags: [{ name: "campaign", value: "test" }],
  };
  const batch = await provider.sendBatch([email]);
  return {
    ok: batch.ok,
    dryRun: batch.dryRun,
    providerMessageId: batch.ids[0] ?? null,
    error: batch.error,
    subject: email.subject,
  };
}
