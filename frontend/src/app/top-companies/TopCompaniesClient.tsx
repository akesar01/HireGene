"use client";

import { useMemo, useState } from "react";
import { TOP_COMPANIES, type TopCompany } from "@/lib/top-companies/companies";
import type { AmazonJob, AmazonMatchResult } from "@/lib/top-companies/amazon";
import MatchBadge from "@/components/MatchBadge";

export default function TopCompaniesClient() {
  const [selectedId, setSelectedId] = useState("amazon");
  const selected = useMemo(
    () => TOP_COMPANIES.find((c) => c.id === selectedId) ?? TOP_COMPANIES[0],
    [selectedId],
  );

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
        Separate from the hiring-manager feed
      </p>
      <h1 className="mt-2 text-3xl font-bold text-foreground tracking-tight">
        Top Companies
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted leading-relaxed">
        Watch official career pages at high-demand employers. Paste your resume,
        we match live roles, and you apply on the company site. We do not submit
        applications for you.
      </p>

      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {TOP_COMPANIES.map((company) => (
          <CompanyCard
            key={company.id}
            company={company}
            selected={company.id === selected.id}
            onSelect={() => setSelectedId(company.id)}
          />
        ))}
      </div>

      {selected.status === "live" && selected.id === "amazon" ? (
        <AmazonMatcher />
      ) : (
        <ComingSoon company={selected} />
      )}
    </div>
  );
}

function CompanyCard({
  company,
  selected,
  onSelect,
}: {
  company: TopCompany;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-xl border p-3.5 transition-all ${
        selected
          ? "border-foreground bg-card-bg shadow-card"
          : "border-card-border bg-card-bg hover:border-muted-light hover:shadow-card"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ background: company.accent }}
        >
          {company.name.charAt(0)}
        </span>
        <span
          className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${
            company.status === "live"
              ? "bg-tag-green-bg text-tag-green-text"
              : "bg-tag-gray-bg text-tag-gray-text"
          }`}
        >
          {company.status === "live" ? "Live" : "Soon"}
        </span>
      </div>
      <p className="mt-2.5 text-sm font-semibold text-foreground">{company.name}</p>
      <p className="mt-0.5 text-[11px] text-muted truncate">{company.source}</p>
    </button>
  );
}

function ComingSoon({ company }: { company: TopCompany }) {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-card-border bg-card-bg p-8 text-center">
      <h2 className="text-lg font-bold text-foreground">{company.name} is not live yet</h2>
      <p className="mt-2 text-sm text-muted max-w-md mx-auto leading-relaxed">
        {company.blurb} Amazon is available now. Pick Amazon to paste a resume
        and match live roles.
      </p>
    </div>
  );
}

function AmazonMatcher() {
  const [resumeText, setResumeText] = useState("");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AmazonMatchResult | null>(null);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/top-companies/amazon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, query, location }),
      });
      const data = (await res.json()) as AmazonMatchResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Search failed (${res.status})`);
      }
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-8">
      <div className="rounded-xl border border-card-border bg-card-bg p-5 sm:p-6 shadow-card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-foreground">Amazon roles</h2>
            <p className="mt-1 text-sm text-muted">
              Paste a resume or a target title. We search amazon.jobs and rank
              what fits. Apply opens Amazon&apos;s official form.
            </p>
          </div>
          <span className="text-xs text-muted bg-surface px-2 py-1 rounded-md">
            amazon.jobs
          </span>
        </div>

        <form onSubmit={onSearch} className="mt-5 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-foreground">Resume</span>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume text here…"
              rows={8}
              className="mt-1.5 w-full rounded-lg border border-card-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-light focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-foreground">
                Title override (optional)
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Software Development Engineer"
                className="mt-1.5 w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-light focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-foreground">
                Location filter (optional)
              </span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Seattle, Austin, Remote…"
                className="mt-1.5 w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-light focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
            </label>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center bg-accent text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-60"
            >
              {loading ? "Matching Amazon roles…" : "Find matching roles"}
            </button>
            <p className="text-xs text-muted">
              You still click Apply on Amazon. We never submit the form.
            </p>
          </div>
        </form>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {result && <AmazonResults result={result} />}
    </section>
  );
}

function AmazonResults({ result }: { result: AmazonMatchResult }) {
  if (result.jobs.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-card-border p-8 text-center">
        <p className="text-sm font-medium text-foreground">No Amazon roles matched</p>
        <p className="mt-1 text-sm text-muted">
          Try a broader title, drop the location filter, or paste more of the resume.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-foreground">
            {result.jobs.length} matching Amazon roles
          </h3>
          <p className="mt-1 text-xs text-muted">
            Searched “{result.query}”
            {result.location ? ` · filtered to ${result.location}` : ""}
            {result.hits > result.jobs.length ? ` · ${result.hits} total hits` : ""}
          </p>
        </div>
        {result.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-end max-w-md">
            {result.keywords.slice(0, 8).map((kw) => (
              <span
                key={kw}
                className="text-[11px] bg-tag-gray-bg text-tag-gray-text px-2 py-0.5 rounded-md"
              >
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>

      <ul className="mt-4 space-y-3">
        {result.jobs.map((job) => (
          <AmazonJobCard key={job.id} job={job} />
        ))}
      </ul>
    </div>
  );
}

function AmazonJobCard({ job }: { job: AmazonJob }) {
  return (
    <li className="bg-card-bg border border-card-border rounded-xl p-4 shadow-card hover:shadow-card-hover hover:border-muted-light/40 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={job.jobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-bold text-foreground leading-snug hover:text-accent"
            >
              {job.title}
            </a>
            {job.matchScore > 0 && (
              <MatchBadge score={job.matchScore} reason={job.matchReason} />
            )}
          </div>
          <p className="mt-1 text-xs text-muted">
            {job.location}
            {job.category ? ` · ${job.category}` : ""}
            {job.business ? ` · ${job.business}` : ""}
            {job.postedRelative ? ` · ${job.postedRelative}` : job.posted ? ` · ${job.posted}` : ""}
          </p>
        </div>
      </div>

      {job.snippet && (
        <p className="mt-2.5 text-sm text-muted leading-relaxed line-clamp-3">
          {job.snippet}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <a
          href={job.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center bg-accent text-white text-sm font-semibold px-3.5 py-1.5 rounded-lg hover:bg-accent-hover transition-colors"
        >
          Apply on Amazon
        </a>
        <a
          href={job.jobUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm font-medium text-muted hover:text-foreground px-2 py-1.5"
        >
          View role
        </a>
      </div>
    </li>
  );
}
