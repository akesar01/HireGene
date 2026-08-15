import { BACKEND_URL, API_KEY } from "./config";
import { excludeExpiredJobs, type Job, type FilterParams, type SortOption } from "./data";

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

export async function fetchJobs(
  sort: SortOption,
  filters: FilterParams,
  authToken?: string,
): Promise<Job[]> {
  if (!API_KEY) {
    throw new Error("API_KEY is not set — cannot fetch from backend");
  }

  const qs = buildQueryString(sort, filters);
  const headers: Record<string, string> = { "x-api-key": API_KEY };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(`${BACKEND_URL}/api/posts/recent?${qs}`, {
    headers,
  });

  if (!res.ok) {
    throw new Error(`Feed API returned ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as FeedResponse;
  return excludeExpiredJobs(data.jobs);
}
