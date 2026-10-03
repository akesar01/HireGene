// Read-only aggregates for the admin dashboard. Raw counts and simple rates;
// no significance claims.

import { MS_PER_DAY, activeJobWhere } from "./job-expiry.js";
import { getProfilesCollection } from "./mongo.js";
import { listEligibleUserIds } from "./nudge-send.js";
import { prisma } from "./prisma.js";

// ─── Subscribers ─────────────────────────────────────────────────────────────

export interface SubscriberStats {
  eligible: number;
  subscribed: number;
  paused: number;
  unsubscribed: number;
  newThisWeek: number;
  byFrequency: { weekly: number; daily: number };
  unsubscribeReasons: Record<string, number>;
}

export async function subscriberStats(now = new Date()): Promise<SubscriberStats> {
  const collection = await getProfilesCollection();
  const weekAgo = new Date(now.getTime() - 7 * MS_PER_DAY);
  const [eligibleIds, newThisWeek] = await Promise.all([
    listEligibleUserIds(),
    collection ? collection.countDocuments({ filterSummary: { $exists: true }, createdAt: { $gte: weekAgo } }) : 0,
  ]);
  const eligible = eligibleIds.length;

  const prefs =
    eligibleIds.length > 0
      ? await prisma.emailPreference.findMany({
          where: { userId: { in: eligibleIds } },
          select: { subscribed: true, frequency: true, pausedUntil: true, unsubscribeReason: true },
        })
      : [];
  let unsubscribed = 0;
  let paused = 0;
  let daily = 0;
  const reasons: Record<string, number> = {};
  for (const p of prefs) {
    if (!p.subscribed) {
      unsubscribed += 1;
      const reason = p.unsubscribeReason ?? "unknown";
      reasons[reason] = (reasons[reason] ?? 0) + 1;
      continue;
    }
    if (p.pausedUntil && p.pausedUntil.getTime() > now.getTime()) {
      paused += 1;
      continue;
    }
    if (p.frequency === "daily") daily += 1;
  }
  // Users without a row default to subscribed weekly (see privacy page).
  const subscribed = Math.max(0, eligible - unsubscribed - paused);
  return {
    eligible,
    subscribed,
    paused,
    unsubscribed,
    newThisWeek,
    byFrequency: { weekly: Math.max(0, subscribed - daily), daily },
    unsubscribeReasons: reasons,
  };
}

// ─── Email performance ───────────────────────────────────────────────────────

export interface SendCounts {
  recipients: number;
  sent: number;
  dryRun: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  failed: number;
  skipped: number;
  holdout: number;
  queued: number;
  openRate: number | null;
  clickRate: number | null;
}

function emptyCounts(): SendCounts {
  return {
    recipients: 0,
    sent: 0,
    dryRun: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    complained: 0,
    unsubscribed: 0,
    failed: 0,
    skipped: 0,
    holdout: 0,
    queued: 0,
    openRate: null,
    clickRate: null,
  };
}

type SendLite = {
  status: string;
  variantId: number | null;
  deliveredAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  bouncedAt: Date | null;
  complainedAt: Date | null;
  unsubscribedAt: Date | null;
};

/** Pure: fold send rows into counts. Open and click rates are per sent email. */
export function foldSendCounts(rows: SendLite[]): SendCounts {
  const c = emptyCounts();
  for (const r of rows) {
    switch (r.status) {
      case "holdout":
        c.holdout += 1;
        continue;
      case "skipped":
        c.skipped += 1;
        continue;
      case "failed":
        c.failed += 1;
        c.recipients += 1;
        continue;
      case "queued":
        c.queued += 1;
        c.recipients += 1;
        continue;
      case "dry_run":
        c.dryRun += 1;
        c.recipients += 1;
        continue;
      default:
        c.recipients += 1;
        c.sent += 1;
    }
    if (r.deliveredAt) c.delivered += 1;
    if (r.openedAt) c.opened += 1;
    if (r.clickedAt) c.clicked += 1;
    if (r.bouncedAt) c.bounced += 1;
    if (r.complainedAt) c.complained += 1;
    if (r.unsubscribedAt) c.unsubscribed += 1;
  }
  if (c.sent > 0) {
    c.openRate = Math.round((c.opened / c.sent) * 1000) / 10;
    c.clickRate = Math.round((c.clicked / c.sent) * 1000) / 10;
  }
  return c;
}

export interface CampaignStats {
  id: number;
  key: string;
  name: string;
  kind: string;
  status: string;
  jobCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  totals: SendCounts;
  variants: {
    id: number;
    key: string;
    name: string;
    weight: number;
    isHoldout: boolean;
    subject: string | null;
    intro: string | null;
    jobCount: number | null;
    counts: SendCounts;
  }[];
}

export async function campaignStats(campaignId?: number): Promise<CampaignStats[]> {
  const campaigns = await prisma.campaign.findMany({
    where: campaignId ? { id: campaignId } : undefined,
    include: {
      variants: { orderBy: { id: "asc" } },
      sends: {
        select: {
          status: true,
          variantId: true,
          deliveredAt: true,
          openedAt: true,
          clickedAt: true,
          bouncedAt: true,
          complainedAt: true,
          unsubscribedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return campaigns.map((c) => ({
    id: c.id,
    key: c.key,
    name: c.name,
    kind: c.kind,
    status: c.status,
    jobCount: c.jobCount,
    createdAt: c.createdAt.toISOString(),
    startedAt: c.startedAt?.toISOString() ?? null,
    completedAt: c.completedAt?.toISOString() ?? null,
    totals: foldSendCounts(c.sends),
    variants: c.variants.map((v) => ({
      id: v.id,
      key: v.key,
      name: v.name,
      weight: v.weight,
      isHoldout: v.isHoldout,
      subject: v.subject,
      intro: v.intro,
      jobCount: v.jobCount,
      counts: foldSendCounts(c.sends.filter((s) => s.variantId === v.id)),
    })),
  }));
}

export interface TopClickedJob {
  jobId: number;
  clicks: number;
  title: string | null;
  company: string | null;
}

export async function topClickedJobs(limit = 10, campaignId?: number): Promise<TopClickedJob[]> {
  const groups = await prisma.nudgeClick.groupBy({
    by: ["jobId"],
    where: { jobId: { not: null }, ...(campaignId ? { send: { campaignId } } : {}) },
    _count: { _all: true },
    orderBy: { _count: { jobId: "desc" } },
    take: limit,
  });
  const ids = groups.map((g) => g.jobId).filter((id): id is number => id !== null);
  const jobs = ids.length
    ? await prisma.job.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, company: true } })
    : [];
  const byId = new Map(jobs.map((j) => [j.id, j]));
  return groups
    .filter((g): g is typeof g & { jobId: number } => g.jobId !== null)
    .map((g) => ({
      jobId: g.jobId,
      clicks: g._count._all,
      title: byId.get(g.jobId)?.title ?? null,
      company: byId.get(g.jobId)?.company ?? null,
    }));
}

// ─── Jobs and site ───────────────────────────────────────────────────────────

export interface JobStats {
  liveJobs: number;
  liveByLevel: Record<string, number>;
  addedPerDay: { day: string; total: number; byLevel: Record<string, number>; bySource: Record<string, number> }[];
  perRecruiter: { recruiterId: number; name: string; liveJobs: number; active: boolean; lastScrapedAt: string | null }[];
  jobClicks: TopClickedJob[];
  totalEmailClicks: number;
}

export async function jobStats(now = new Date(), days = 14): Promise<JobStats> {
  const since = new Date(now.getTime() - days * MS_PER_DAY);
  const [live, recent, perRecruiterGroups, recruiters, clicks, totalEmailClicks] = await Promise.all([
    prisma.job.findMany({ where: activeJobWhere(now), select: { seniority: true } }),
    prisma.job.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, seniority: true, source: true },
    }),
    prisma.job.groupBy({ by: ["recruiterId"], where: activeJobWhere(now), _count: { _all: true } }),
    prisma.recruiter.findMany({ select: { id: true, name: true, active: true, lastScrapedAt: true } }),
    topClickedJobs(10),
    prisma.nudgeClick.count({ where: { jobId: { not: null } } }),
  ]);

  const liveByLevel: Record<string, number> = {};
  for (const j of live) liveByLevel[j.seniority] = (liveByLevel[j.seniority] ?? 0) + 1;

  const perDay = new Map<string, { total: number; byLevel: Record<string, number>; bySource: Record<string, number> }>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(now.getTime() - i * MS_PER_DAY).toISOString().slice(0, 10);
    perDay.set(day, { total: 0, byLevel: {}, bySource: {} });
  }
  for (const j of recent) {
    const day = j.createdAt.toISOString().slice(0, 10);
    const entry = perDay.get(day);
    if (!entry) continue;
    entry.total += 1;
    entry.byLevel[j.seniority] = (entry.byLevel[j.seniority] ?? 0) + 1;
    entry.bySource[j.source] = (entry.bySource[j.source] ?? 0) + 1;
  }

  const countByRecruiter = new Map(perRecruiterGroups.map((g) => [g.recruiterId, g._count._all]));
  const perRecruiter = recruiters
    .map((r) => ({
      recruiterId: r.id,
      name: r.name,
      active: r.active,
      liveJobs: countByRecruiter.get(r.id) ?? 0,
      lastScrapedAt: r.lastScrapedAt?.toISOString() ?? null,
    }))
    .sort((a, b) => b.liveJobs - a.liveJobs || a.name.localeCompare(b.name));

  return {
    liveJobs: live.length,
    liveByLevel,
    addedPerDay: [...perDay.entries()].map(([day, v]) => ({ day, ...v })),
    perRecruiter,
    jobClicks: clicks,
    totalEmailClicks,
  };
}
