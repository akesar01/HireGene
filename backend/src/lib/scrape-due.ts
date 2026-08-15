import { scrapeRecruiter } from "./apify.js";
import { prisma } from "./prisma.js";
import { pickDueRecruiter, type RecruiterSchedule } from "./scrape-schedule.js";

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
