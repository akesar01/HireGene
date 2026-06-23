import {
  jobs as mockJobs,
  filterJobs,
  sortJobs,
  SORT_OPTIONS,
  SOURCE_OPTIONS,
  type SortOption,
  type SourceFilter,
  type FilterParams,
  type Job,
} from "@/lib/data";
import { fetchJobs } from "@/lib/api";
import { JOB_EXPIRY_DAYS } from "@/lib/config";
import Sidebar from "@/components/Sidebar";
import SortTabs from "@/components/SortTabs";
import JobCard from "@/components/JobCard";
import SocialProof from "@/components/SocialProof";
import Link from "next/link";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseSort(value: unknown): SortOption {
  if (typeof value === "string" && SORT_OPTIONS.includes(value as SortOption)) {
    return value as SortOption;
  }
  return "hot";
}

function parseSource(value: unknown): SourceFilter {
  if (typeof value === "string" && SOURCE_OPTIONS.includes(value as SourceFilter)) {
    return value as SourceFilter;
  }
  return "all";
}

function parseString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

interface FilterState {
  sort: string;
  source: string;
  role_family: string;
  seniority: string;
  remote_mode: string;
  stack: string;
  company: string;
}

function makeBuildHref(state: FilterState) {
  return (key: string, value: string): string => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) {
      if (k === key) {
        if (v !== value) params.set(k, value);
      } else if (v) {
        params.set(k, v);
      }
    }
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const metadata = {
  title: "SkipTheBoard — Real tech jobs from hiring managers, not job boards",
  description:
    "Browse real tech jobs posted by hiring managers on LinkedIn and X. Community-ranked, auto-expiring feed with direct links to original posts. No job boards.",
  alternates: { canonical: "/" },
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const sort = parseSort(params.sort);
  const source = parseSource(params.source);
  const roleFamily = parseString(params.role_family);
  const seniority = parseString(params.seniority);
  const remoteMode = parseString(params.remote_mode);
  const stack = parseString(params.stack);
  const company = parseString(params.company);

  const filters: FilterParams = {
    source,
    roleFamily,
    seniority,
    remoteMode,
    stack,
    company,
  };

  let allJobs: Job[];
  try {
    allJobs = await fetchJobs(sort, filters);
  } catch {
    allJobs = mockJobs;
  }

  const results = sortJobs(filterJobs(allJobs, filters), sort);

  const uniqueCompanies = new Set(allJobs.map((j) => j.company)).size;
  const uniqueManagers = new Set(allJobs.map((j) => j.author)).size;

  const filterState: FilterState = {
    sort,
    source: source !== "all" ? source : "",
    role_family: roleFamily,
    seniority,
    remote_mode: remoteMode,
    stack,
    company,
  };
  const buildHref = makeBuildHref(filterState);

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <header className="border-b border-card-border bg-card-bg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground tracking-tight">SkipTheBoard</span>
            <span className="hidden sm:inline text-xs text-muted">— stalk the poster, not the board</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted hidden sm:inline">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5 align-middle" />
              {results.length} live jobs
            </span>
            <Link
              href="/submit"
              className="inline-flex items-center gap-1 bg-accent text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors"
            >
              + submit
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero pitch ── */}
      <section className="bg-card-bg border-b border-card-border">
        <div className="max-w-7xl mx-auto px-6 py-10 sm:py-14">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight max-w-3xl leading-tight">
            The best tech jobs aren&apos;t on job boards.
            <br />
            <span className="text-accent">They&apos;re hiding in LinkedIn posts.</span>
          </h1>
          <p className="mt-4 text-base text-muted max-w-2xl leading-relaxed">
            We watch real hiring managers founders, VPs, team leads across LinkedIn .
            Every post they make gets captured here before it vanishes.
            No job boards. Just real jobs from the people actually hiring.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="#feed"
              className="inline-flex items-center gap-1.5 bg-foreground text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-foreground/90 transition-colors"
            >
              Browse jobs
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </a>
            <span className="text-xs text-muted-light">
              🗳️ Community-ranked · ⏰ Auto-expires in {JOB_EXPIRY_DAYS} days · 🔗 Always links to source
            </span>
          </div>

          {/* Social proof stats */}
          <div className="mt-5">
            <SocialProof
              totalJobs={allJobs.length}
              totalCompanies={uniqueCompanies}
              totalManagers={uniqueManagers}
            />
          </div>
        </div>
      </section>

      {/* ── Main content ── */}
      <div className="max-w-7xl mx-auto px-6 py-6" id="feed">
        {/* Sort tabs */}
        <div className="mb-6">
          <SortTabs currentSort={sort} buildHref={buildHref} />
        </div>

        {/* 3-column: Filters + Feed + Info */}
        <div className="flex gap-6">
          {/* Left: Filter sidebar */}
          <aside className="hidden md:block w-56 shrink-0">
            <div className="sticky top-20 bg-card-bg border border-card-border rounded-xl p-4 shadow-card max-h-[calc(100vh-6rem)] overflow-y-auto">
              <Sidebar
                currentSource={source}
                currentRoleFamily={roleFamily}
                currentSeniority={seniority}
                currentRemoteMode={remoteMode}
                currentStack={stack}
                currentCompany={company}
                jobs={results}
                buildHref={buildHref}
              />
            </div>
          </aside>

          {/* Center: Feed */}
          <main className="flex-1 min-w-0" aria-label="Job listings">
            {results.length > 0 ? (
              <div className="space-y-4">
                {results.map((job, i) => (
                  <JobCard key={job.id} job={job} rank={i + 1} />
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-muted bg-card-bg border border-card-border rounded-lg">
                no jobs match your filters.{" "}
                <Link href="/" className="text-accent hover:underline font-medium">
                  clear all
                </Link>
              </div>
            )}
          </main>

          {/* Right: Info sidebar */}
          <aside className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-20 space-y-4">
              {/* Stats card */}
              <div className="bg-card-bg border border-card-border rounded-xl p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{results.length}</p>
                    <p className="text-xs text-muted">live jobs</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center">
                    <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* How it works */}
              <div className="bg-card-bg border border-card-border rounded-xl p-5 shadow-card">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">
                  How it works
                </h3>
                <ul className="space-y-3 text-[13px] text-muted leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-accent-light text-accent flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                    <span>We monitor <strong className="text-foreground">real hiring managers</strong> on LinkedIn &amp; X</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-accent-light text-accent flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                    <span>Every post is captured with a direct link to the original</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-accent-light text-accent flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                    <span>You upvote real jobs, downvote spam. Community decides.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-accent-light text-accent flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">4</span>
                    <span>Posts auto-expire after {JOB_EXPIRY_DAYS} days. Fresh stuff only.</span>
                  </li>
                </ul>
              </div>

              {/* CTA card */}
              <div className="bg-gradient-to-br from-accent to-[#ff8c42] rounded-xl p-5 text-white shadow-card">
                <h3 className="text-sm font-bold mb-1">Know a hiring manager?</h3>
                <p className="text-xs text-white/90 leading-relaxed mb-3">
                  Submit their LinkedIn or X profile and we&apos;ll start tracking their posts.
                </p>
                <Link
                  href="/submit"
                  className="inline-flex items-center gap-1 bg-white text-accent text-xs font-semibold px-3 py-2 rounded-lg hover:bg-white/90 transition-colors"
                >
                  + add a recruiter
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
