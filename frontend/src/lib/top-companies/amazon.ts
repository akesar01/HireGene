import { extractResumeSignals, scoreJobText, type ResumeSignals } from "./keywords";

const AMAZON_SEARCH = "https://www.amazon.jobs/en/search.json";
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_FETCH = 100;

export interface AmazonJob {
  id: string;
  title: string;
  location: string;
  city: string;
  country: string;
  category: string;
  business: string;
  posted: string;
  postedRelative: string;
  snippet: string;
  applyUrl: string;
  jobUrl: string;
  matchScore: number;
  matchReason: string;
}

interface AmazonRawJob {
  id?: string;
  id_icims?: string | number;
  title?: string;
  location?: string;
  city?: string;
  country_code?: string;
  normalized_location?: string;
  job_category?: string;
  business_category?: string;
  posted_date?: string;
  updated_time?: string;
  description?: string;
  description_short?: string;
  basic_qualifications?: string;
  preferred_qualifications?: string;
  job_path?: string;
  url_next_step?: string;
}

interface AmazonSearchResponse {
  hits?: number;
  jobs?: AmazonRawJob[];
}

interface CacheEntry {
  at: number;
  hits: number;
  jobs: AmazonRawJob[];
}

const cache = new Map<string, CacheEntry>();

function humanizeSlug(value: string): string {
  if (!value) return "";
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => (part.toLowerCase() === "aws" || part.toLowerCase() === "ww" ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSentences(text: string, max = 220): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" "));
  return `${(lastStop > 80 ? cut.slice(0, lastStop) : cut).trim()}…`;
}

async function requestAmazonJobs(query: string): Promise<{ hits: number; jobs: AmazonRawJob[] }> {
  const params = new URLSearchParams({
    base_query: query,
    offset: "0",
    result_limit: String(MAX_FETCH),
    sort: "relevant",
  });

  const res = await fetch(`${AMAZON_SEARCH}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      Referer: "https://www.amazon.jobs/en/search",
      Origin: "https://www.amazon.jobs",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Amazon jobs search failed (${res.status})`);
  }

  const data = (await res.json()) as AmazonSearchResponse;
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  const hits = typeof data.hits === "number" ? data.hits : jobs.length;
  return { hits, jobs };
}

async function fetchAmazonJobs(query: string): Promise<{ hits: number; jobs: AmazonRawJob[] }> {
  const key = query.toLowerCase().trim() || "software engineer";
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS && cached.jobs.length > 0) {
    return { hits: cached.hits, jobs: cached.jobs };
  }

  let result = await requestAmazonJobs(key);
  if (result.jobs.length === 0) {
    result = await requestAmazonJobs(key);
  }
  if (result.jobs.length === 0) {
    throw new Error("Amazon returned no roles. Try again in a moment.");
  }

  cache.set(key, { at: Date.now(), hits: result.hits, jobs: result.jobs });
  return result;
}

function matchesLocation(job: AmazonRawJob, location: string): boolean {
  if (!location) return true;
  const needle = location.toLowerCase().trim();
  const hay = [
    job.location,
    job.city,
    job.normalized_location,
    job.country_code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

function toAmazonJob(raw: AmazonRawJob, signals: ResumeSignals | null): AmazonJob {
  const icims = raw.id_icims != null ? String(raw.id_icims) : "";
  const path = raw.job_path || (icims ? `/en/jobs/${icims}` : "");
  const title = (raw.title ?? "").trim();
  const description = stripHtml(raw.description || raw.description_short || "");
  const qualifications = stripHtml(
    [raw.basic_qualifications, raw.preferred_qualifications].filter(Boolean).join(" "),
  );
  const category = raw.job_category ?? "";
  const scored = signals
    ? scoreJobText(
        { title, description, qualifications, category },
        signals,
      )
    : { score: 0, reason: "Keyword search" };

  return {
    id: icims || raw.id || path,
    title,
    location: raw.normalized_location || raw.location || raw.city || "Location not listed",
    city: raw.city ?? "",
    country: raw.country_code ?? "",
    category,
    business: humanizeSlug(raw.business_category ?? ""),
    posted: raw.posted_date ?? "",
    postedRelative: raw.updated_time ?? "",
    snippet: firstSentences(description || qualifications),
    applyUrl: raw.url_next_step || (icims ? `https://account.amazon.jobs/jobs/${icims}/apply` : `https://www.amazon.jobs${path}`),
    jobUrl: path ? `https://www.amazon.jobs${path}` : "https://www.amazon.jobs",
    matchScore: scored.score,
    matchReason: scored.reason,
  };
}

export interface AmazonMatchInput {
  resumeText?: string;
  query?: string;
  location?: string;
}

export interface AmazonMatchResult {
  company: "amazon";
  query: string;
  location: string;
  hits: number;
  jobs: AmazonJob[];
  titles: string[];
  keywords: string[];
}

export async function matchAmazonJobs(input: AmazonMatchInput): Promise<AmazonMatchResult> {
  const resumeText = (input.resumeText ?? "").trim();
  const explicitQuery = (input.query ?? "").trim();
  const signals = resumeText ? extractResumeSignals(resumeText) : null;
  const location = (input.location ?? "").trim() || signals?.inferredLocation || "";
  const query = explicitQuery || signals?.query || "software engineer";

  const { hits, jobs: rawJobs } = await fetchAmazonJobs(query);
  const filtered = location
    ? rawJobs.filter((job) => matchesLocation(job, location))
    : rawJobs;

  const jobs = filtered
    .map((job) => toAmazonJob(job, signals))
    .sort((a, b) => b.matchScore - a.matchScore || a.title.localeCompare(b.title))
    .slice(0, 40);

  return {
    company: "amazon",
    query,
    location,
    hits: location ? jobs.length : hits,
    jobs,
    titles: signals?.titles ?? [],
    keywords: signals?.keywords.slice(0, 12) ?? [],
  };
}
