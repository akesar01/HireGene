import {
  jobs as mockJobs,
  excludeExpiredJobs,
  type FilterParams,
} from "@/lib/data";
import { fetchJobs } from "@/lib/api";
import { JOB_EXPIRY_DAYS } from "@/lib/config";
import { auth } from "@clerk/nextjs/server";
import { getProfile, type ResumeProfile } from "@/lib/profile";
import { computeTagOverlapScore } from "@/lib/match";
import JobBoard from "@/components/JobBoard";
import SocialProof from "@/components/SocialProof";
import Header from "@/components/Header";
import PersonalizationPrompt from "@/components/PersonalizationPrompt";
import HeroSignInCTA from "@/components/HeroSignInCTA";
import Link from "next/link";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseString(value: unknown): string {
  return typeof value === "string" ? value : "";
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

  const country = parseString(params.country);
  const roleFamily = parseString(params.role_family);
  const seniority = parseString(params.seniority);
  const remoteMode = parseString(params.remote_mode);
  const company = parseString(params.company);
  const appliedOnly = params.applied_only === "true";

  // Check if user is logged in and has a profile
  const session = await auth();
  let userProfile: ResumeProfile | null = null;
  let usingProfileFilters = false;
  let authToken: string | null = null;
  if (session?.userId) {
    try {
      authToken = await session.getToken();
      if (authToken) {
        userProfile = await getProfile(authToken);
      }
    } catch {
      // Profile fetch failed — continue without personalization
    }
  }

  // Personalization is based on MATCH-SCORE RANKING, not hard filtering.
  // We never restrict the feed by profile attributes (that empties the feed).
  // Instead: fetch all jobs honoring only explicit URL filters, then rank by match.
  const hasUrlFilters = !!(country || roleFamily || seniority || remoteMode || company);
  const hasProfile = !!userProfile?.filterSummary;

  // Personalized ranking active only when logged-in user has a profile
  // AND hasn't manually applied URL filters (URL filters take precedence).
  const personalizedRanking = hasProfile && !hasUrlFilters;
  usingProfileFilters = personalizedRanking;

  const feedFilters: FilterParams = {
    source: "all",
    roleFamily: "",
    seniority: "",
    remoteMode: "",
    stack: "",
    company: "",
    appliedOnly,
  };

  let allJobs;
  try {
    allJobs = excludeExpiredJobs(
      await fetchJobs("new", feedFilters, authToken ?? undefined),
    );
  } catch {
    allJobs = mockJobs;
  }

  const matchScores: Record<string, number> = {};
  if (userProfile?.filterSummary) {
    for (const job of allJobs) {
      matchScores[String(job.id)] = computeTagOverlapScore(job, userProfile.filterSummary);
    }
  }

  const uniqueCompanies = new Set(allJobs.map((j) => j.company)).size;
  const uniqueManagers = new Set(allJobs.map((j) => j.author)).size;

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <Header liveJobsCount={allJobs.length} />

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
          <p className="mt-2 text-sm text-muted max-w-2xl leading-relaxed">
            <span className="text-accent font-medium">New:</span> Upload your resume and we&apos;ll rank jobs by match, then write a ready-to-copy DM from the original post and your resume. You send it.
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
            {!session?.userId && <HeroSignInCTA />}
          </div>
          <p className="mt-3 text-xs text-muted-light">
            🗳️ Community-ranked · ⏰ Auto-expires in {JOB_EXPIRY_DAYS} days · 🔗 Always links to source · 🎯 AI-personalized feed
          </p>

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
        {/* Profile filter banner */}
        {usingProfileFilters && (
          <div className="mb-4 flex items-center justify-between bg-accent-light border border-accent/20 rounded-lg px-4 py-2.5">
            <p className="text-sm text-foreground">
              <span className="font-semibold">Personalized feed</span> - match scores shown from your resume
            </p>
            <Link href="/?" className="text-xs font-medium text-accent hover:text-accent-hover transition-colors">
              Clear
            </Link>
          </div>
        )}

        {session?.userId && (
          <div className="mb-4 flex items-center justify-end">
            <Link
              href={appliedOnly ? "/" : "/?applied_only=true"}
              className={[
                "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors shrink-0",
                appliedOnly
                  ? "bg-green-500/10 border-green-500/30 text-green-600"
                  : "bg-surface border-card-border text-muted hover:border-green-500/30 hover:text-green-600",
              ].join(" ")}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {appliedOnly ? "Applied Only" : "Show Applied"}
            </Link>
          </div>
        )}

        <div className="flex gap-6">
          <main className="min-w-0 flex-1" aria-label="Job listings">
            <JobBoard
              jobs={allJobs}
              initialFilters={{
                country,
                roleFamily,
                seniority,
                remoteMode,
                company,
              }}
              profile={userProfile}
              matchScores={matchScores}
            />
          </main>

          {/* Right: Info sidebar */}
          <aside className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-20 space-y-4">
              {/* Personalization prompt (anonymous users) */}
              <PersonalizationPrompt hasProfile={!!userProfile} />

              {/* Stats card */}
              <div className="bg-card-bg border border-card-border rounded-xl p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{allJobs.length}</p>
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
                    <span><strong className="text-foreground">Upload your resume</strong> - AI ranks jobs and writes a ready DM you copy and send</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-accent-light text-accent flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">4</span>
                    <span>You upvote real jobs, downvote spam. Community decides.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-accent-light text-accent flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">5</span>
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
