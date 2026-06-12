import {
  jobs,
  filterJobs,
  sortJobs,
  SORT_OPTIONS,
  SOURCE_OPTIONS,
  type SortOption,
  type SourceFilter,
  type FilterParams,
} from "@/lib/data";
import Sidebar from "@/components/Sidebar";
import JobCard from "@/components/JobCard";
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

// ─── Page ─────────────────────────────────────────────────────────────────────

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

  const filters: FilterParams = {
    source,
    roleFamily,
    seniority,
    remoteMode,
    stack,
  };

  const results = sortJobs(filterJobs(jobs, filters), sort);

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <header className="px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <h1 className="text-xl font-bold text-foreground">
                jobs in the wild.
              </h1>
            </Link>
            <span className="hidden sm:inline text-xs text-muted uppercase tracking-wide">
              linkedin &amp; x hiring posts — curated by community
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-light hidden sm:inline">
              ● 2,517 people here now
            </span>
          </div>
        </div>

        {/* Tagline */}
        <h2 className="mt-4 text-2xl sm:text-3xl font-bold text-foreground leading-tight max-w-3xl">
          the place for hiring posts aggregated across linkedin and twitter from real bosses.
        </h2>
        <p className="mt-2 text-sm text-muted">
          upvote the good ones. downvote the spam.
        </p>
      </header>

      {/* ── Main content ── */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        {/* Filters row */}
        <section className="mb-6" aria-label="Filters">
          <div className="flex items-center justify-between mb-3">
            <Sidebar
              currentSort={sort}
              currentSource={source}
              currentRoleFamily={roleFamily}
              currentSeniority={seniority}
              currentRemoteMode={remoteMode}
              currentStack={stack}
            />
            <Link
              href="/submit"
              className="shrink-0 ml-4 inline-flex items-center gap-1 bg-accent text-white text-sm font-semibold px-5 py-2.5 rounded hover:bg-accent-hover transition-colors"
            >
              + add a job
            </Link>
          </div>
        </section>

        {/* 2-column: Feed + Sidebar */}
        <div className="flex gap-8">
          {/* Left: Feed */}
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
            <div className="sticky top-6 space-y-5">
              {/* Why this exists */}
              <div className="bg-sidebar-bg border border-card-border rounded-lg p-5 shadow-card">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">
                  Why This Exists
                </h3>
                <div className="space-y-2 text-[13px] text-muted leading-relaxed">
                  <p>
                    the best jobs in tech aren&apos;t on job boards. they&apos;re
                    in posts written by founders, vps, and team leads who are
                    actually hiring, and most of those posts vanish in a day.
                  </p>
                  <p>we collect them here. that&apos;s it.</p>
                  <p className="text-muted-light">
                    posts auto-expire after 7 days. fresh stuff only.
                  </p>
                </div>
              </div>

              {/* Upvote if */}
              <div className="bg-sidebar-bg border border-card-border rounded-lg p-5 shadow-card">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">
                  Upvote ▲ If
                </h3>
                <ul className="space-y-2 text-[13px] text-muted leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-accent mt-0.5">•</span>
                    <span>the poster is the <strong className="text-foreground">actual hiring manager</strong> (founder, head, lead, the person you&apos;d dm)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent mt-0.5">•</span>
                    <span>the role is clear: what, where, what they want</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent mt-0.5">•</span>
                    <span>you&apos;d reply if you fit</span>
                  </li>
                </ul>
              </div>

              {/* Downvote if */}
              <div className="bg-sidebar-bg border border-card-border rounded-lg p-5 shadow-card">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">
                  Downvote ▼ If
                </h3>
                <ul className="space-y-2 text-[13px] text-muted leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-muted-light mt-0.5">•</span>
                    <span>recruiter / agency spam (&quot;hiring for 10 companies, send resume&quot;)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-muted-light mt-0.5">•</span>
                    <span>a quote-post of someone else&apos;s role</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-muted-light mt-0.5">•</span>
                    <span>generic &quot;we&apos;re hiring for 50 roles&quot; with no specifics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-muted-light mt-0.5">•</span>
                    <span>the post is older than two weeks</span>
                  </li>
                </ul>
              </div>

              {/* The Mission */}
              <div className="bg-sidebar-bg border border-card-border rounded-lg p-5 shadow-card">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">
                  The Mission
                </h3>
                <div className="space-y-2 text-[13px] text-muted leading-relaxed">
                  <p>
                    posts by bosses on linkedin and twitter are the only ones that
                    get you the best jobs. this is a community-run product, your
                    votes decide what stays at the top.
                  </p>
                  <p className="text-muted-light mt-3">team tal</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
