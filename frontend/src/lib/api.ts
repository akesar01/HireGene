import { BACKEND_URL, API_KEY } from "./config";
import { excludeExpiredJobs, type Job, type JobDetail, type FilterParams, type SortOption } from "./data";

interface FeedResponse {
  jobs: Job[];
  count: number;
}

function buildQueryString(
  sort: SortOption,
  filters: FilterParams,
): string {
  const params = new URLSearchParams();
  params.set("sort", sort);
  if (filters.roleFamily) params.set("role_family", filters.roleFamily);
  if (filters.seniority) params.set("seniority", filters.seniority);
  if (filters.remoteMode) params.set("remote_mode", filters.remoteMode);
  if (filters.stack) params.set("stack", filters.stack);
  if (filters.source !== "all") params.set("source", filters.source);
  if (filters.company) params.set("company", filters.company);
  if (filters.appliedOnly) params.set("applied_only", "true");
  return params.toString();
}

/** Seconds the anonymous feed is reused from the Next.js data cache. */
export const ANONYMOUS_FEED_REVALIDATE_SECONDS = 60;

/**
 * The anonymous feed is the same for everyone, so it is cached for 60s.
 * A signed-in request carries the user's token and is never cached or shared.
 */
export function feedRequestInit(apiKey: string, authToken?: string): RequestInit {
  if (authToken) {
    return {
      headers: { "x-api-key": apiKey, Authorization: `Bearer ${authToken}` },
      cache: "no-store",
    };
  }
  return {
    headers: { "x-api-key": apiKey },
    next: { revalidate: ANONYMOUS_FEED_REVALIDATE_SECONDS },
  };
}

export async function fetchJobs(
  sort: SortOption,
  filters: FilterParams,
  authToken?: string,
): Promise<Job[]> {
  if (!API_KEY) {
    throw new Error("API_KEY is not set — cannot fetch from backend");
  }

  const qs = buildQueryString(sort, filters);
  const res = await fetch(
    `${BACKEND_URL}/api/posts/recent?${qs}`,
    feedRequestInit(API_KEY, authToken),
  );

  if (!res.ok) {
    throw new Error(`Feed API returned ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as FeedResponse;
  return excludeExpiredJobs(data.jobs);
}

/** Seconds a job page's data is reused; the page itself revalidates on the same clock. */
export const JOB_PAGE_REVALIDATE_SECONDS = 300;

/** One job for its public page, or null when it does not exist (or was purged). */
export async function fetchJobDetail(id: number): Promise<JobDetail | null> {
  if (!API_KEY) {
    throw new Error("API_KEY is not set — cannot fetch from backend");
  }

  const res = await fetch(`${BACKEND_URL}/api/posts/${id}`, {
    headers: { "x-api-key": API_KEY },
    next: { revalidate: JOB_PAGE_REVALIDATE_SECONDS },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Job API returned ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { job: JobDetail };
  return data.job;
}
