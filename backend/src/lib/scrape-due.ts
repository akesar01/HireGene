import { scrapeRecruiter } from "./apify.js";
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
  result: Awaited<ReturnType<typeof scrapeRecruiter>> | null;
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
  const recruiters = await loadActiveRecruiters();
  const { picked, dueCount } = pickDueRecruiter(recruiters, excludeIds);

  if (!picked) {
    return { picked: null, dueCount: 0, remaining: 0, result: null, error: null };
  }

  try {
    const result = await scrapeRecruiter(picked);
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
  error: string | null;
}

export interface ScrapeBatchSummary {
  dueBefore: number;
  processed: number;
  failed: number;
  remaining: number;
  exhaustedBudget: boolean;
  results: ScrapeBatchItem[];
}

export async function scrapeDueBatch(options: {
  once?: boolean;
  budgetMs?: number;
} = {}): Promise<ScrapeBatchSummary> {
  const once = options.once ?? false;
  const budgetMs = options.budgetMs ?? DEFAULT_BATCH_BUDGET_MS;
  const startedAtMs = Date.now();
  const excludeIds: number[] = [];
  const results: ScrapeBatchItem[] = [];

  const initial = pickDueRecruiter(await loadActiveRecruiters(), excludeIds);
  const dueBefore = initial.dueCount;

  if (!initial.picked) {
    return {
      dueBefore: 0,
      processed: 0,
      failed: 0,
      remaining: 0,
      exhaustedBudget: false,
      results,
    };
  }

  while (true) {
    if (results.length > 0 && !hasBudgetForAnotherScrape(startedAtMs, budgetMs)) {
      const leftover = pickDueRecruiter(await loadActiveRecruiters(), excludeIds);
      return {
        dueBefore,
        processed: results.filter((item) => item.ok).length,
        failed: results.filter((item) => !item.ok).length,
        remaining: leftover.dueCount,
        exhaustedBudget: true,
        results,
      };
    }

    const outcome = await scrapeNextDue(excludeIds);
    if (!outcome.picked) {
      return {
        dueBefore,
        processed: results.filter((item) => item.ok).length,
        failed: results.filter((item) => !item.ok).length,
        remaining: 0,
        exhaustedBudget: false,
        results,
      };
    }

    if (outcome.error) {
      excludeIds.push(outcome.picked.id);
    }

    results.push({
      recruiterId: outcome.picked.id,
      name: outcome.picked.name,
      ok: outcome.error === null,
      jobsCreated: outcome.result?.jobsCreated ?? 0,
      jobsSkipped: outcome.result?.jobsSkipped ?? 0,
      error: outcome.error,
    });

    if (once) {
      return {
        dueBefore,
        processed: results.filter((item) => item.ok).length,
        failed: results.filter((item) => !item.ok).length,
        remaining: outcome.remaining,
        exhaustedBudget: false,
        results,
      };
    }
  }
}
