import type { MetadataRoute } from "next";
import { fetchJobs } from "@/lib/api";
import { SITE_URL } from "@/lib/config";
import type { FilterParams, Job } from "@/lib/data";
import { jobUrl } from "@/lib/job-seo";

// Rebuilt at most every 10 minutes; the feed fetch itself is cached for 60s.
export const revalidate = 600;

const ALL_JOBS: FilterParams = {
  source: "all",
  roleFamily: "",
  seniority: "",
  remoteMode: "",
  stack: "",
  company: "",
};

/** Live (unexpired) jobs, or none when the backend is unreachable. */
async function liveJobs(): Promise<Job[]> {
  try {
    return await fetchJobs("new", ALL_JOBS);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const jobs = await liveJobs();

  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1.0,
    },
    ...jobs.map((job) => ({
      url: jobUrl(job),
      // A job page changes only when the job is captured or re-captured.
      lastModified: new Date(job.createdAt ?? job.postedAt),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/submit`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/careers`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
