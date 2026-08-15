"use client";

import { useEffect, useMemo, useState } from "react";
import type { Job } from "@/lib/data";
import { filterJobs, sortJobs } from "@/lib/data";
import type { ResumeProfile } from "@/lib/profile";
import FilterBar, { type FeedFilters } from "./FilterBar";
import JobCard from "./JobCard";
import PersonalizedFeed from "./PersonalizedFeed";

const EMPTY_FILTERS: FeedFilters = {
  country: "",
  roleFamily: "",
  seniority: "",
  remoteMode: "",
  company: "",
};

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function writeFilterUrl(filters: FeedFilters) {
  const params = new URLSearchParams(window.location.search);
  const map: Record<keyof FeedFilters, string> = {
    country: "country",
    roleFamily: "role_family",
    seniority: "seniority",
    remoteMode: "remote_mode",
    company: "company",
  };
  (Object.keys(map) as (keyof FeedFilters)[]).forEach((key) => {
    const param = map[key];
    if (filters[key]) params.set(param, filters[key]);
    else params.delete(param);
  });
  params.delete("sort");
  const qs = params.toString();
  window.history.replaceState(window.history.state, "", qs ? `/?${qs}` : "/");
}

interface JobBoardProps {
  jobs: Job[];
  initialFilters: FeedFilters;
  profile: ResumeProfile | null;
  matchScores: Record<string, number>;
}

export default function JobBoard({
  jobs,
  initialFilters,
  profile,
  matchScores,
}: JobBoardProps) {
  const [filters, setFilters] = useState<FeedFilters>(initialFilters);

  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      setFilters({
        country: params.get("country") ?? "",
        roleFamily: params.get("role_family") ?? "",
        seniority: params.get("seniority") ?? "",
        remoteMode: params.get("remote_mode") ?? "",
        company: params.get("company") ?? "",
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const results = useMemo(
    () =>
      sortJobs(
        filterJobs(jobs, {
          source: "all",
          roleFamily: filters.roleFamily,
          seniority: filters.seniority,
          remoteMode: filters.remoteMode,
          stack: "",
          company: filters.company,
          country: filters.country,
        }),
        "new",
      ),
    [jobs, filters],
  );

  function update(key: keyof FeedFilters, value: string) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    writeFilterUrl(next);
  }

  function clear() {
    setFilters(EMPTY_FILTERS);
    writeFilterUrl(EMPTY_FILTERS);
  }

  return (
    <div>
      <FilterBar
        filters={filters}
        roles={uniqueSorted(jobs.map((job) => job.roleFamily))}
        seniorities={uniqueSorted(jobs.map((job) => job.seniority))}
        remoteModes={uniqueSorted(jobs.map((job) => job.remoteMode))}
        companies={uniqueSorted(jobs.map((job) => job.company))}
        resultCount={results.length}
        totalCount={jobs.length}
        onChange={update}
        onClear={clear}
      />

      {results.length > 0 ? (
        profile?.filterSummary ? (
          <PersonalizedFeed
            jobs={results}
            profile={profile}
            initialScores={matchScores}
          />
        ) : (
          <div className="space-y-4">
            {results.map((job, i) => (
              <JobCard key={job.id} job={job} rank={i + 1} />
            ))}
          </div>
        )
      ) : (
        <div className="rounded-lg border border-card-border bg-card-bg py-16 text-center text-sm text-muted">
          No jobs match these filters.{" "}
          <button
            type="button"
            onClick={clear}
            className="font-medium text-accent hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
