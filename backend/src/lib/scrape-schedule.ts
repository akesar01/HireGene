export const MAX_EXCLUDE_IDS = 200;

export interface RecruiterSchedule {
  id: number;
  name: string;
  linkedinUrl: string;
  active: boolean;
  scrapeIntervalHours: number;
  lastScrapedAt: Date | null;
}

export function isRecruiterDue(
  recruiter: Pick<RecruiterSchedule, "active" | "lastScrapedAt" | "scrapeIntervalHours">,
  now: Date = new Date(),
): boolean {
  if (!recruiter.active) return false;
  if (!recruiter.lastScrapedAt) return true;

  const intervalMs = Math.max(recruiter.scrapeIntervalHours, 1) * 60 * 60 * 1000;
  return now.getTime() - recruiter.lastScrapedAt.getTime() >= intervalMs;
}

export function parseExcludeIds(raw: string | undefined): number[] {
  if (!raw) return [];

  const ids: number[] = [];
  const seen = new Set<number>();
  for (const part of raw.split(",")) {
    const id = Number.parseInt(part.trim(), 10);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= MAX_EXCLUDE_IDS) break;
  }
  return ids;
}

export function hasBudgetForAnotherScrape(
  startedAtMs: number,
  budgetMs: number,
  nowMs: number = Date.now(),
  minRemainingMs: number = 15_000,
): boolean {
  return startedAtMs + budgetMs - nowMs >= minRemainingMs;
}

export function pickDueRecruiter<T extends RecruiterSchedule>(
  recruiters: T[],
  excludeIds: number[] = [],
  now: Date = new Date(),
): { picked: T | null; dueCount: number } {
  const excluded = new Set(excludeIds);
  const due = recruiters
    .filter((recruiter) => !excluded.has(recruiter.id) && isRecruiterDue(recruiter, now))
    .sort((a, b) => {
      if (!a.lastScrapedAt && !b.lastScrapedAt) return a.id - b.id;
      if (!a.lastScrapedAt) return -1;
      if (!b.lastScrapedAt) return 1;
      const byTime = a.lastScrapedAt.getTime() - b.lastScrapedAt.getTime();
      return byTime !== 0 ? byTime : a.id - b.id;
    });

  return { picked: due[0] ?? null, dueCount: due.length };
}
