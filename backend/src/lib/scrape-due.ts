import {
  finishPendingRuns,
  recruiterIdsWithOpenRuns,
  startApifyRun,
  waitAndIngest,
  type ScrapeResult,
} from "./apify.js";
import { prisma } from "./prisma.js";
import {
  hasBudgetForAnotherScrape,
  pickDueRecruiter,
  type RecruiterSchedule,
} from "./scrape-schedule.js";

const DEFAULT_BATCH_BUDGET_MS = 240_000;

export interface DueScrapeResult {
  picked: RecruiterSchedule | null;
  dueCount: number;
  remaining: number;
  result: ScrapeResult | null;
  error: string | null;
}

export async function loadActiveRecruiters(): Promise<RecruiterSchedule[]> {
  return prisma.recruiter.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      linkedinUrl: true,
      active: true,
      scrapeIntervalHours: true,
      lastScrapedAt: true,
    },
    orderBy: { lastScrapedAt: { sort: "asc", nulls: "first" } },
  });
}

export async function scrapeNextDue(excludeIds: number[] = []): Promise<DueScrapeResult> {
  const inFlight = await recruiterIdsWithOpenRuns();
  const blocked = [...excludeIds, ...inFlight];
  const recruiters = await loadActiveRecruiters();
  const { picked, dueCount } = pickDueRecruiter(recruiters, blocked);

  if (!picked) {
    return { picked: null, dueCount: 0, remaining: 0, result: null, error: null };
  }

  try {
    const runId = await startApifyRun(picked);
    const result = await waitAndIngest(picked, runId, 15_000);
    return {
      picked,
      dueCount,
      remaining: Math.max(dueCount - 1, 0),
      result,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      picked,
      dueCount,
      remaining: Math.max(dueCount - 1, 0),
      result: null,
      error: message,
    };
  }
}

export interface ScrapeBatchItem {
  recruiterId: number;
  name: string;
  ok: boolean;
  jobsCreated: number;
  jobsSkipped: number;
  pending?: boolean;
  error: string | null;
}

export interface ScrapeBatchSummary {
  dueBefore: number;
  processed: number;
  failed: number;
  remaining: number;
  exhaustedBudget: boolean;
  pending: number;
  results: ScrapeBatchItem[];
}

export async function scrapeDueBatch(options: {
  once?: boolean;
  budgetMs?: number;
} = {}): Promise<ScrapeBatchSummary> {
  const once = options.once ?? false;
  const budgetMs = options.budgetMs ?? DEFAULT_BATCH_BUDGET_MS;
  const startedAtMs = Date.now();
  const results: ScrapeBatchItem[] = [];

  const pendingFirst = await finishPendingRuns({
    budgetMs: Math.min(60_000, budgetMs),
  });
  for (const detail of pendingFirst) {
    const recruiter = await prisma.recruiter.findUnique({
      where: { id: detail.recruiterId },
      select: { name: true },
    });
    results.push({
      recruiterId: detail.recruiterId,
      name: recruiter?.name ?? `#${detail.recruiterId}`,
      ok: detail.status === "SUCCEEDED" || detail.pending === true,
      jobsCreated: detail.jobsCreated,
      jobsSkipped: detail.jobsSkipped,
      pending: detail.pending,
      error: detail.status === "FAILED" ? `Run ${detail.apifyRunId} ${detail.status}` : null,
    });
  }

  const excludeIds: number[] = await recruiterIdsWithOpenRuns();
  const initial = pickDueRecruiter(await loadActiveRecruiters(), excludeIds);
  const dueBefore = initial.dueCount;

  if (once) {
    const outcome = await scrapeNextDue(excludeIds);
    if (outcome.picked) {
      results.push(itemFromOutcome(outcome));
    }
    return summary(dueBefore, results, outcome.remaining, false);
  }

  while (hasBudgetForAnotherScrape(startedAtMs, budgetMs)) {
    const inFlight = await recruiterIdsWithOpenRuns();
    const { picked, dueCount } = pickDueRecruiter(
      await loadActiveRecruiters(),
      [...excludeIds, ...inFlight],
    );
    if (!picked) break;

    try {
      const runId = await startApifyRun(picked);
      excludeIds.push(picked.id);
      results.push({
        recruiterId: picked.id,
        name: picked.name,
        ok: true,
        jobsCreated: 0,
        jobsSkipped: 0,
        pending: true,
        error: null,
      });
      void runId;
    } catch (err) {
      excludeIds.push(picked.id);
      results.push({
        recruiterId: picked.id,
        name: picked.name,
        ok: false,
        jobsCreated: 0,
        jobsSkipped: 0,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }

    if (dueCount <= 1) break;
  }

  const leftoverMs = Math.max(startedAtMs + budgetMs - Date.now(), 20_000);
  const ingested = await finishPendingRuns({ budgetMs: leftoverMs });
  mergeIngested(results, ingested);

  const leftover = pickDueRecruiter(
    await loadActiveRecruiters(),
    await recruiterIdsWithOpenRuns(),
  );
  const exhaustedBudget = leftover.dueCount > 0 && !hasBudgetForAnotherScrape(startedAtMs, budgetMs);
  return summary(dueBefore, results, leftover.dueCount, exhaustedBudget);
}

function itemFromOutcome(outcome: DueScrapeResult): ScrapeBatchItem {
  const picked = outcome.picked!;
  return {
    recruiterId: picked.id,
    name: picked.name,
    ok: outcome.error === null,
    jobsCreated: outcome.result?.jobsCreated ?? 0,
    jobsSkipped: outcome.result?.jobsSkipped ?? 0,
    pending: outcome.result?.pending,
    error: outcome.error,
  };
}

function mergeIngested(
  results: ScrapeBatchItem[],
  ingested: Awaited<ReturnType<typeof finishPendingRuns>>,
) {
  for (const detail of ingested) {
    const existing = results.find((item) => item.recruiterId === detail.recruiterId);
    if (existing) {
      existing.jobsCreated = detail.jobsCreated;
      existing.jobsSkipped = detail.jobsSkipped;
      existing.pending = detail.pending;
      existing.ok = detail.status === "SUCCEEDED" || detail.pending === true;
      if (detail.status === "SUCCEEDED") existing.error = null;
      continue;
    }
    results.push({
      recruiterId: detail.recruiterId,
      name: `#${detail.recruiterId}`,
      ok: detail.status === "SUCCEEDED" || detail.pending === true,
      jobsCreated: detail.jobsCreated,
      jobsSkipped: detail.jobsSkipped,
      pending: detail.pending,
      error: null,
    });
  }
}

function summary(
  dueBefore: number,
  results: ScrapeBatchItem[],
  remaining: number,
  exhaustedBudget: boolean,
): ScrapeBatchSummary {
  return {
    dueBefore,
    processed: results.filter((item) => item.ok && !item.pending).length,
    failed: results.filter((item) => !item.ok).length,
    remaining,
    exhaustedBudget,
    pending: results.filter((item) => item.pending).length,
    results,
  };
}
