export const DEFAULT_APIFY_MAX_CONCURRENT = 5;

export class ApifyConcurrentLimitError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`Apify concurrent run limit: ${status} ${body}`);
    this.name = "ApifyConcurrentLimitError";
    this.status = status;
    this.body = body;
  }
}

export function maxConcurrentApifyRuns(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number(env.APIFY_MAX_CONCURRENT ?? DEFAULT_APIFY_MAX_CONCURRENT);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_APIFY_MAX_CONCURRENT;
}

export function remainingApifyStartSlots(
  openCount: number,
  maxConcurrent: number = maxConcurrentApifyRuns(),
): number {
  const open = Number.isFinite(openCount) && openCount > 0 ? openCount : 0;
  return Math.max(0, maxConcurrent - open);
}

export function isApifyConcurrentLimitError(status: number, body: string): boolean {
  return status === 402 && body.includes("concurrent-runs-limit-exceeded");
}
