export type Source = "linkedin" | "x";
export type SortOption = "hot" | "new" | "top";

export interface Job {
  id: number;
  title: string;
  company: string;
  author: string;
  authorTitle: string;
  roleBadge: string;
  source: Source;
  sourceUrl: string;
  roleFamily: string;
  seniority: string;
  remoteMode: string;
  stack: string[];
  description: string[];
  comments: number;
  postedAt: string;
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

export interface ScrapeResult {
  scraped: number;
  jobsCreated: number;
  jobsSkipped: number;
  details: Array<{
    recruiterId: number;
    apifyRunId: string;
    status: string;
    postsFound: number;
    jobsCreated: number;
    jobsSkipped: number;
  }>;
}
