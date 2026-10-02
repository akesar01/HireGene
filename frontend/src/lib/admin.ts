// Admin API client. Every call carries the signed-in user's Clerk token; the
// backend decides who is an admin (ADMIN_USER_IDS / ADMIN_EMAILS).

import { BACKEND_URL } from "./config";

export class AdminApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function adminFetch<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AdminApiError(body.error ?? `Request failed (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

// ─── Types mirrored from the backend ─────────────────────────────────────────

export interface SubscriberStats {
  eligible: number;
  subscribed: number;
  paused: number;
  unsubscribed: number;
  newThisWeek: number;
  byFrequency: { weekly: number; daily: number };
  unsubscribeReasons: Record<string, number>;
}

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

export interface VariantStats {
  id: number;
  key: string;
  name: string;
  weight: number;
  isHoldout: boolean;
  subject: string | null;
  intro: string | null;
  jobCount: number | null;
  counts: SendCounts;
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
  variants: VariantStats[];
}

export interface TopClickedJob {
  jobId: number;
  clicks: number;
  title: string | null;
  company: string | null;
}

export interface EmailStats {
  campaigns: CampaignStats[];
  topClickedJobs: TopClickedJob[];
}

export interface JobStats {
  liveJobs: number;
  liveByLevel: Record<string, number>;
  addedPerDay: { day: string; total: number; byLevel: Record<string, number>; bySource: Record<string, number> }[];
  perRecruiter: { recruiterId: number; name: string; liveJobs: number; active: boolean; lastScrapedAt: string | null }[];
  jobClicks: TopClickedJob[];
  totalEmailClicks: number;
}

export interface NudgeUser {
  userId: string;
  name: string | null;
  email: string | null;
  currentTitle: string | null;
  seniority: string | null;
  roleFamily: string | null;
  subscribed: boolean;
  frequency: string;
  pausedUntil: string | null;
  lastSentAt: string | null;
}

export interface PreviewPick {
  id: number;
  title: string;
  company: string;
  matchPercent: number;
  levelLabel: string;
  posterKind: string;
  seniorOverride: boolean;
  isNew: boolean;
}

export interface NudgePreview {
  userId: string;
  email: string | null;
  name: string | null;
  campaign: { id: number | null; key: string; name: string };
  variant: { id: number; key: string; name: string; isHoldout: boolean } | null;
  rendered: { subject: string; preheader: string; html: string; text: string } | null;
  picks: PreviewPick[];
  poolSize: number;
  reason: string | null;
}

export interface Schedule {
  paused: boolean;
  cron: string;
  description: string;
  todayWouldRun: { key: string; name: string; kind: string };
}

export interface CampaignVariantInput {
  key: string;
  name: string;
  weight: number;
  isHoldout: boolean;
  subject: string | null;
  intro: string | null;
  jobCount: number | null;
}

export interface CampaignSummary {
  id: number;
  key: string;
  name: string;
  kind: string;
  status: string;
  jobCount: number;
  createdBy: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  sends: number;
  variants: (CampaignVariantInput & { id: number })[];
}

export interface RunResult {
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
  alreadyClaimed: number;
  remaining: number;
  exhaustedBudget: boolean;
  completed: boolean;
}

export interface Submission {
  id: number;
  name: string;
  linkedinUrl: string;
  company: string | null;
  title: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  recruiterId: number | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface Recruiter {
  id: number;
  name: string;
  linkedinUrl: string;
  active: boolean;
  scrapeIntervalHours: number;
  addedAt: string;
  lastScrapedAt: string | null;
}

// ─── Calls ───────────────────────────────────────────────────────────────────

export const adminApi = {
  whoami: (token: string) => adminFetch<{ ok: boolean; via: string; userId: string | null }>(token, "/api/admin/whoami"),
  subscribers: (token: string) => adminFetch<SubscriberStats>(token, "/api/admin/stats/subscribers"),
  email: (token: string) => adminFetch<EmailStats>(token, "/api/admin/stats/email"),
  jobs: (token: string, days = 14) => adminFetch<JobStats>(token, `/api/admin/stats/jobs?days=${days}`),
  users: (token: string, q: string) =>
    adminFetch<{ users: NudgeUser[]; total: number }>(token, `/api/admin/nudges/users?q=${encodeURIComponent(q)}`),
  preview: (token: string, userId: string, campaignId?: number | null, variantId?: number | null) => {
    const params = new URLSearchParams({ userId });
    if (campaignId) params.set("campaignId", String(campaignId));
    if (variantId) params.set("variantId", String(variantId));
    return adminFetch<NudgePreview>(token, `/api/admin/nudges/preview?${params}`);
  },
  sendTest: (token: string, body: { to: string; userId: string; campaignId?: number | null; variantId?: number | null }) =>
    adminFetch<{ ok: boolean; dryRun: boolean; providerMessageId: string | null; error?: string; subject?: string }>(
      token,
      "/api/admin/nudges/test",
      { method: "POST", body: JSON.stringify(body) },
    ),
  schedule: (token: string) => adminFetch<Schedule>(token, "/api/admin/nudges/schedule"),
  setSchedulePaused: (token: string, paused: boolean) =>
    adminFetch<{ paused: boolean }>(token, "/api/admin/nudges/schedule", { method: "PUT", body: JSON.stringify({ paused }) }),
  campaigns: (token: string) => adminFetch<{ campaigns: CampaignSummary[] }>(token, "/api/admin/nudges/campaigns"),
  createCampaign: (token: string, body: { name: string; jobCount?: number; variants: CampaignVariantInput[] }) =>
    adminFetch<{ campaign: CampaignSummary }>(token, "/api/admin/nudges/campaigns", { method: "POST", body: JSON.stringify(body) }),
  sendNow: (token: string, campaignId?: number) =>
    adminFetch<RunResult>(token, "/api/admin/nudges/send-now", { method: "POST", body: JSON.stringify({ campaignId }) }),
  submissions: (token: string) => adminFetch<{ submissions: Submission[] }>(token, "/api/admin/submissions?status=pending"),
  approveSubmission: (token: string, id: number) => adminFetch<unknown>(token, `/api/admin/submissions/${id}/approve`, { method: "POST" }),
  rejectSubmission: (token: string, id: number) => adminFetch<unknown>(token, `/api/admin/submissions/${id}/reject`, { method: "POST" }),
  recruiters: (token: string) => adminFetch<{ recruiters: Recruiter[] }>(token, "/api/admin/recruiters"),
  scrape: (token: string, recruiterId: number) =>
    adminFetch<{ jobsCreated?: number; jobsSkipped?: number; pending?: boolean; message?: string }>(token, "/api/admin/scrape", {
      method: "POST",
      body: JSON.stringify({ recruiterId }),
    }),
};
