import { beforeEach, describe, expect, it, vi } from "vitest";

const { emails, clerkLookup, CRON_SECRET } = vi.hoisted(() => {
  const CRON_SECRET = "cron-test-secret";
  process.env.CRON_SECRET = CRON_SECRET;
  const emails = {} as Record<string, string>;
  const clerkLookup = async (ids: string[]) =>
    new Map(ids.filter((id) => emails[id]).map((id) => [id, { userId: id, email: emails[id], firstName: null }]));
  return { emails, clerkLookup, CRON_SECRET };
});

vi.mock("../src/lib/prisma", async () => {
  const { createFakePrisma } = await import("./helpers/fake-prisma");
  return { prisma: createFakePrisma() };
});
vi.mock("../src/lib/mongo", async () => {
  const { createFakeProfiles } = await import("./helpers/fake-prisma");
  const profiles = createFakeProfiles([]);
  return { getProfilesCollection: async () => profiles, getDb: async () => null };
});
vi.mock("../src/lib/clerk-users", () => ({ fetchClerkUsers: vi.fn(clerkLookup) }));
vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));

import app from "../src/index";
import { prisma } from "../src/lib/prisma";
import { getProfilesCollection } from "../src/lib/mongo";
import { fetchClerkUsers } from "../src/lib/clerk-users";
import type { EmailProvider, OutgoingEmail } from "../src/lib/email";
import {
  ensureScheduledCampaign,
  isSchedulePaused,
  isoWeekKey,
  loadJobSignals,
  nextNudgeTick,
  runCampaign,
  scheduledCampaignFor,
  sendTestNudge,
  setSchedulePaused,
  type RunCampaignResult,
} from "../src/lib/nudge-send";

const db = prisma as unknown as ReturnType<typeof import("./helpers/fake-prisma").createFakePrisma>;
const NOW = new Date("2026-09-28T02:30:00Z"); // a Monday

class RecordingProvider implements EmailProvider {
  readonly name = "recording";
  batches: OutgoingEmail[][] = [];
  constructor(readonly dryRun: boolean, private fail = false) {}
  async sendBatch(emailsIn: OutgoingEmail[]) {
    this.batches.push(emailsIn);
    if (this.fail) return { ok: false, ids: emailsIn.map(() => null), error: "boom", dryRun: this.dryRun };
    return { ok: true, ids: emailsIn.map((_, i) => (this.dryRun ? null : `msg_${this.batches.length}_${i}`)), dryRun: this.dryRun };
  }
  get sent(): OutgoingEmail[] {
    return this.batches.flat();
  }
}

function seedJob(id: number, overrides: Record<string, unknown> = {}) {
  db.job.rows.push({
    id,
    recruiterId: 1,
    title: `SDE 1 #${id}`,
    company: "M2P Fintech",
    author: "Srinivasarao",
    authorTitle: "Engineering Manager at M2P",
    source: "linkedin",
    sourceUrl: `https://www.linkedin.com/posts/job-${id}`,
    roleFamily: "engineering",
    seniority: "junior",
    remoteMode: "in_office",
    stack: ["python", "java"],
    description: ["2+ years of experience", "Bangalore"],
    rawText: "Hiring SDE 1",
    postedAt: new Date("2026-09-23T10:00:00Z"),
    createdAt: new Date("2026-09-26T04:00:00Z"),
    ...overrides,
  });
}

const sdeProfile = (userId: string) => ({
  _id: userId,
  contact: { name: `${userId} Name`, email: "resume@example.com" },
  filterSummary: { currentTitle: "SDE", roleFamily: "engineering", seniority: "junior", remoteMode: "in_office", stack: ["java", "python"] },
  createdAt: new Date("2026-09-01T00:00:00Z"),
});

async function seedProfiles(ids: string[]) {
  const collection = (await getProfilesCollection()) as unknown as { docs: Record<string, unknown>[] };
  collection.docs.length = 0;
  for (const id of ids) collection.docs.push(sdeProfile(id));
}

async function createCampaign(kind: "weekly" | "daily" | "manual" | "experiment" = "weekly", variants: Record<string, unknown>[] = []) {
  const campaign = await db.campaign.create({
    data: { key: `${kind}-${Math.random().toString(36).slice(2)}`, name: "Test", kind, status: "draft", jobCount: 5, createdBy: "test" },
  });
  for (const v of variants) await db.campaignVariant.create({ data: { campaignId: campaign.id, ...v } });
  return campaign;
}

beforeEach(async () => {
  db.$reset();
  for (const key of Object.keys(emails)) delete emails[key];
  await seedProfiles([]);
  for (let i = 1; i <= 6; i += 1) seedJob(i);
});

describe("runCampaign", () => {
  it("dry-runs without a provider key: renders, records one row per recipient, calls the provider once", async () => {
    await seedProfiles(["user_a", "user_b"]);
    emails.user_a = "a@example.com";
    emails.user_b = "b@example.com";
    const campaign = await createCampaign();
    const provider = new RecordingProvider(true);

    const result = await runCampaign({ campaignId: campaign.id, provider, now: NOW });

    expect(result).toMatchObject({ dryRun: true, candidates: 2, processed: 2, sent: 2, skipped: 0, failed: 0, remaining: 0, completed: true });
    expect(provider.batches).toHaveLength(1);
    expect(provider.sent.map((e) => e.to).sort()).toEqual(["a@example.com", "b@example.com"]);
    expect(provider.sent[0].headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(provider.sent[0].headers?.["List-Unsubscribe"]).toMatch(/^<https?:\/\/.+\/api\/email\/unsubscribe\?t=.+>$/);

    const rows = await db.nudgeSend.findMany({});
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.status).toBe("dry_run");
      expect(row.jobIds).toHaveLength(5);
      expect(row.subject).toBe("5 new jobs that match you");
      expect(row.providerMessageId).toBeNull();
    }
    const prefs = await db.emailPreference.findMany({});
    expect(prefs).toHaveLength(2);
    expect(prefs.every((p) => p.lastSentAt instanceof Date && p.email)).toBe(true);
    expect((await db.campaign.findUnique({ where: { id: campaign.id } }))!.status).toBe("completed");
  });

  it("is idempotent per user per campaign: a re-run sends nothing new", async () => {
    await seedProfiles(["user_a"]);
    emails.user_a = "a@example.com";
    const campaign = await createCampaign();
    const provider = new RecordingProvider(false);

    const first = await runCampaign({ campaignId: campaign.id, provider, now: NOW });
    expect(first.sent).toBe(1);
    const row = (await db.nudgeSend.findMany({}))[0];
    expect(row.status).toBe("sent");
    expect(row.providerMessageId).toBe("msg_1_0");

    // Reopen the campaign as if a retry fired before completion was recorded.
    await db.campaign.update({ where: { id: campaign.id }, data: { status: "running" } });
    const second = await runCampaign({ campaignId: campaign.id, provider, now: NOW });
    expect(second.candidates).toBe(0);
    expect(second.sent).toBe(0);
    expect(provider.batches).toHaveLength(1);
    expect(await db.nudgeSend.count({})).toBe(1);
  });

  it("never double-sends when a second run of the same campaign overlaps with this one", async () => {
    await seedProfiles(["user_a"]);
    emails.user_a = "a@example.com";
    const campaign = await createCampaign();
    const provider = new RecordingProvider(false);

    // The overlapping run starts after this run has listed its recipients but
    // before it has written its rows, and finishes first.
    const overlapping: RunCampaignResult[] = [];
    vi.mocked(fetchClerkUsers).mockImplementationOnce(async (ids) => {
      overlapping.push(await runCampaign({ campaignId: campaign.id, provider, now: NOW }));
      return clerkLookup(ids);
    });

    const late = await runCampaign({ campaignId: campaign.id, provider, now: NOW });
    const [early] = overlapping;

    expect(early.sent).toBe(1);
    expect(late.sent).toBe(0);
    expect(late.alreadyClaimed).toBe(1);
    expect(late.failed).toBe(0);
    expect(late.completed).toBe(true);
    expect(provider.sent.map((e) => e.to)).toEqual(["a@example.com"]);
    const rows = await db.nudgeSend.findMany({});
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("sent");
    expect((await db.campaign.findUnique({ where: { id: campaign.id } }))!.status).toBe("completed");
  });

  it("skips a user with zero qualifying jobs instead of sending an empty email", async () => {
    await seedProfiles(["user_a"]);
    emails.user_a = "a@example.com";
    const earlier = await createCampaign();
    await db.nudgeSend.create({
      data: { id: "prev", campaignId: earlier.id, userId: "user_a", email: "a@example.com", status: "sent", jobIds: [1, 2, 3, 4, 5, 6], sentAt: new Date("2026-09-21T02:30:00Z") },
    });
    const campaign = await createCampaign();
    const provider = new RecordingProvider(true);

    const result = await runCampaign({ campaignId: campaign.id, provider, now: NOW });

    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(0);
    expect(provider.batches).toHaveLength(0);
    const row = await db.nudgeSend.findUnique({ where: { campaignId_userId: { campaignId: campaign.id, userId: "user_a" } } });
    expect(row!.status).toBe("skipped");
  });

  it("never emails unsubscribed or paused users, and daily campaigns only reach daily subscribers", async () => {
    await seedProfiles(["user_unsub", "user_paused", "user_weekly", "user_daily"]);
    for (const id of ["user_unsub", "user_paused", "user_weekly", "user_daily"]) emails[id] = `${id}@example.com`;
    await db.emailPreference.create({ data: { userId: "user_unsub", subscribed: false, frequency: "weekly", unsubscribeToken: "t1", unsubscribedAt: NOW } });
    await db.emailPreference.create({ data: { userId: "user_paused", subscribed: true, frequency: "weekly", unsubscribeToken: "t2", pausedUntil: new Date("2026-10-30T00:00:00Z") } });
    await db.emailPreference.create({ data: { userId: "user_daily", subscribed: true, frequency: "daily", unsubscribeToken: "t3" } });

    const weekly = await createCampaign("weekly");
    const weeklyProvider = new RecordingProvider(true);
    const weeklyResult = await runCampaign({ campaignId: weekly.id, provider: weeklyProvider, now: NOW });
    expect(weeklyResult.inactive).toBe(2);
    expect(weeklyProvider.sent.map((e) => e.to).sort()).toEqual(["user_daily@example.com", "user_weekly@example.com"]);

    const daily = await createCampaign("daily");
    const dailyProvider = new RecordingProvider(true);
    await runCampaign({ campaignId: daily.id, provider: dailyProvider, now: NOW });
    expect(dailyProvider.sent.map((e) => e.to)).toEqual(["user_daily@example.com"]);
  });

  it("splits an experiment deterministically and sends nothing to the holdout arm", async () => {
    const ids = Array.from({ length: 40 }, (_, i) => `user_${i}`);
    await seedProfiles(ids);
    for (const id of ids) emails[id] = `${id}@example.com`;
    const campaign = await createCampaign("experiment", [
      { key: "A", name: "Short subject", weight: 40, isHoldout: false, subject: "{count} matches for {name}", intro: null, jobCount: 3 },
      { key: "B", name: "Default", weight: 40, isHoldout: false, subject: null, intro: null, jobCount: null },
      { key: "control", name: "Holdout", weight: 20, isHoldout: true, subject: null, intro: null, jobCount: null },
    ]);
    const variants = await db.campaignVariant.findMany({ where: { campaignId: campaign.id } });
    const byKey = Object.fromEntries(variants.map((v) => [v.key, v.id]));
    const provider = new RecordingProvider(false);

    const result = await runCampaign({ campaignId: campaign.id, provider, now: NOW });

    const rows = await db.nudgeSend.findMany({ where: { campaignId: campaign.id } });
    expect(rows).toHaveLength(40);
    expect(rows.every((r) => r.variantId !== null)).toBe(true);
    const holdout = rows.filter((r) => r.variantId === byKey.control);
    const armA = rows.filter((r) => r.variantId === byKey.A);
    const armB = rows.filter((r) => r.variantId === byKey.B);
    expect(holdout.length).toBeGreaterThan(0);
    expect(armA.length).toBeGreaterThan(0);
    expect(armB.length).toBeGreaterThan(0);
    expect(holdout.every((r) => r.status === "holdout" && r.jobIds.length === 0)).toBe(true);
    expect(result.holdout).toBe(holdout.length);
    expect(provider.sent).toHaveLength(40 - holdout.length);
    expect(armA.every((r) => r.jobIds.length === 3 && /^\d+ matches for /.test(r.subject))).toBe(true);
    expect(armB.every((r) => r.jobIds.length === 5 && r.subject === "5 new jobs that match you")).toBe(true);
    expect(armA.every((r) => r.status === "sent" && r.providerMessageId)).toBe(true);
    for (const email of provider.sent) {
      expect(holdout.some((h) => h.email === email.to)).toBe(false);
    }
  });

  it("stops at the time budget and finishes on the next invocation", async () => {
    await seedProfiles(["user_a", "user_b", "user_c"]);
    for (const id of ["user_a", "user_b", "user_c"]) emails[id] = `${id}@example.com`;
    const campaign = await createCampaign();
    const provider = new RecordingProvider(true);

    const first = await runCampaign({ campaignId: campaign.id, provider, now: NOW, pageSize: 1, budgetMs: 0 });
    expect(first.processed).toBe(1);
    expect(first.remaining).toBe(2);
    expect(first.exhaustedBudget).toBe(true);
    expect(first.completed).toBe(false);
    expect((await db.campaign.findUnique({ where: { id: campaign.id } }))!.status).toBe("running");

    const second = await runCampaign({ campaignId: campaign.id, provider, now: NOW });
    expect(second.processed).toBe(2);
    expect(second.remaining).toBe(0);
    expect(second.completed).toBe(true);
    expect(await db.nudgeSend.count({})).toBe(3);
  });

  it("records a failed provider call per row without losing idempotency", async () => {
    await seedProfiles(["user_a"]);
    emails.user_a = "a@example.com";
    const campaign = await createCampaign();
    const provider = new RecordingProvider(false, true);

    const result = await runCampaign({ campaignId: campaign.id, provider, now: NOW });
    expect(result.failed).toBe(1);
    const row = (await db.nudgeSend.findMany({}))[0];
    expect(row.status).toBe("failed");
    expect(row.error).toBe("boom");
  });

  it("records a user with no Clerk email as failed rather than mailing the resume address", async () => {
    await seedProfiles(["user_noemail"]);
    const campaign = await createCampaign();
    const provider = new RecordingProvider(true);
    const result = await runCampaign({ campaignId: campaign.id, provider, now: NOW });
    expect(result.failed).toBe(1);
    expect(provider.sent).toHaveLength(0);
    const row = (await db.nudgeSend.findMany({}))[0];
    expect(row.error).toBe("no Clerk email");
    expect(row.email).toBe("");
  });
});

describe("sendTestNudge", () => {
  it("mails the typed address with a [TEST] subject, no unsubscribe headers and an inert footer, and records nothing", async () => {
    await seedProfiles(["user_a"]);
    emails.user_a = "a@example.com";
    const provider = new RecordingProvider(true);

    const result = await sendTestNudge({ to: "captain@example.com", userId: "user_a", provider, now: NOW });

    expect(result.ok).toBe(true);
    expect(result.subject).toMatch(/^\[TEST\] 5 new jobs that match you$/);
    expect(provider.sent).toHaveLength(1);
    const email = provider.sent[0];
    expect(email.to).toBe("captain@example.com");
    expect(email.headers).toBeUndefined();
    for (const out of [email.html, email.text]) {
      expect(out).toContain("unsubscribe disabled in test sends");
      expect(out).not.toContain("/unsubscribe?t=");
    }
    expect(await db.nudgeSend.count({})).toBe(0);
  });
});

describe("loadJobSignals", () => {
  it("counts applications and distinct clicking sends per job, so a redirect plus webhook click counts once", async () => {
    for (const userId of ["u1", "u2", "u3"]) db.jobApplication.rows.push({ id: db.jobApplication.rows.length + 1, jobId: 1, userId });
    db.nudgeClick.rows.push(
      { id: 1, sendId: "s1", jobId: 2, source: "redirect" },
      { id: 2, sendId: "s1", jobId: 2, source: "webhook" },
      { id: 3, sendId: "s2", jobId: 2, source: "redirect" },
      { id: 4, sendId: "s3", jobId: null, source: "webhook" },
    );
    const signals = await loadJobSignals([1, 2, 3]);
    expect(signals.get(1)).toEqual({ applied: 3, viewers: 0 });
    expect(signals.get(2)).toEqual({ applied: 0, viewers: 2 });
    expect(signals.has(3)).toBe(false);
  });

  it("puts the applied count on the card in a preview send", async () => {
    await seedProfiles(["user_a"]);
    emails.user_a = "a@example.com";
    for (const userId of ["u1", "u2", "u3", "u4"]) db.jobApplication.rows.push({ id: db.jobApplication.rows.length + 1, jobId: 1, userId });
    const provider = new RecordingProvider(true);

    await sendTestNudge({ to: "captain@example.com", userId: "user_a", provider, now: NOW });

    const email = provider.sent[0];
    expect(email.text).toContain("4 people applied via SkipTheBoard");
    expect(email.html.match(/people applied via SkipTheBoard/g)).toHaveLength(1);
  });
});

describe("scheduled campaigns", () => {
  it("starts paused: with no settings row the cron creates no campaign until an admin resumes", async () => {
    expect(await isSchedulePaused()).toBe(true);
    expect(await ensureScheduledCampaign(NOW)).toBeNull();
    expect(await db.campaign.count({})).toBe(0);

    await setSchedulePaused(false);
    expect(await isSchedulePaused()).toBe(false);
    const campaign = await ensureScheduledCampaign(NOW);
    expect(campaign).toMatchObject({ key: "weekly-2026-W40", kind: "weekly", createdBy: "cron" });
    expect(await db.campaign.count({})).toBe(1);

    await setSchedulePaused(true);
    expect(await isSchedulePaused()).toBe(true);
    expect(await ensureScheduledCampaign(new Date("2026-10-05T02:30:00Z"))).toBeNull();
    expect(await db.campaign.count({})).toBe(1);
  });

  it("the cron endpoint sends nothing on a fresh deployment and sends once the schedule is resumed", async () => {
    await seedProfiles(["user_daily"]);
    emails.user_daily = "daily@example.com";
    await db.emailPreference.create({ data: { userId: "user_daily", subscribed: true, frequency: "daily", unsubscribeToken: "t-daily" } });
    db.job.rows.length = 0;
    seedJob(1, { postedAt: new Date(), createdAt: new Date() });
    const headers = { Authorization: `Bearer ${CRON_SECRET}` };

    const paused = await app.request("/api/cron/nudges", { method: "POST", headers });
    expect(paused.status).toBe(200);
    await expect(paused.json()).resolves.toMatchObject({ ok: true, skipped: true });
    expect(await db.campaign.count({})).toBe(0);
    expect(await db.nudgeSend.count({})).toBe(0);

    await setSchedulePaused(false);
    const resumed = await app.request("/api/cron/nudges", { method: "POST", headers });
    expect(resumed.status).toBe(200);
    await expect(resumed.json()).resolves.toMatchObject({ ok: true, sent: 1, remaining: 0, completed: true, dryRun: true });
    expect(await db.campaign.count({})).toBe(1);
    const rows = await db.nudgeSend.findMany({});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: "user_daily", status: "dry_run" });
  });
});

describe("schedule helpers", () => {
  it("names Monday runs by ISO week and other days by date", () => {
    expect(isoWeekKey(new Date("2026-09-28T02:30:00Z"))).toBe("2026-W40");
    expect(scheduledCampaignFor(new Date("2026-09-28T02:30:00Z"))).toMatchObject({ key: "weekly-2026-W40", kind: "weekly" });
    expect(scheduledCampaignFor(new Date("2026-09-29T02:30:00Z"))).toMatchObject({ key: "daily-2026-09-29", kind: "daily" });
    expect(isoWeekKey(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
  });

  it("finds the next 02:30 UTC tick: today when before it, otherwise tomorrow", () => {
    expect(nextNudgeTick(new Date("2026-09-28T01:00:00Z")).toISOString()).toBe("2026-09-28T02:30:00.000Z");
    expect(nextNudgeTick(new Date("2026-09-28T02:30:00Z")).toISOString()).toBe("2026-09-29T02:30:00.000Z");
    expect(nextNudgeTick(new Date("2026-09-27T23:00:00Z")).toISOString()).toBe("2026-09-28T02:30:00.000Z");
    expect(scheduledCampaignFor(nextNudgeTick(new Date("2026-09-27T23:00:00Z")))).toMatchObject({ key: "weekly-2026-W40", kind: "weekly" });
    expect(scheduledCampaignFor(nextNudgeTick(new Date("2026-09-28T10:00:00Z")))).toMatchObject({ key: "daily-2026-09-29", kind: "daily" });
  });
});
