import Link from "next/link";
import {
  getTagCounts,
  SOURCE_OPTIONS,
  type SourceFilter,
  type TagCount,
  type Job,
} from "@/lib/data";
import FilterRadio from "./FilterRadio";
import CompanyDropdown from "./CompanyDropdown";

function formatLabel(value: string): string {
  return value.replace(/_/g, "-");
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  currentSource: SourceFilter;
  currentRoleFamily: string;
  currentSeniority: string;
  currentRemoteMode: string;
  currentStack: string;
  currentCompany: string;
  jobs: Job[];
  buildHref: (key: string, value: string) => string;
}

// ─── Filter Group ─────────────────────────────────────────────────────────────

function FilterGroup({
  title,
  items,
  filterKey,
  currentValue,
  buildHref,
}: {
  title: string;
  items: TagCount[];
  filterKey: string;
  currentValue: string;
  buildHref: (key: string, value: string) => string;
}) {
  return (
    <div className="space-y-0.5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-light px-2 mb-1">
        {title}
      </h3>
      <FilterRadio
        label="All"
        href={buildHref(filterKey, "")}
        active={!currentValue}
      />
      {items.map(({ value, count }) => (
        <FilterRadio
          key={value}
          label={formatLabel(value)}
          count={count}
          href={buildHref(filterKey, value)}
          active={currentValue === value}
        />
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar({
  currentSource,
  currentRoleFamily,
  currentSeniority,
  currentRemoteMode,
  currentStack,
  currentCompany,
  jobs,
  buildHref,
}: SidebarProps) {
  const roleCounts = getTagCounts(jobs, "roleFamily");
  const seniorityCounts = getTagCounts(jobs, "seniority");
  const remoteModeCounts = getTagCounts(jobs, "remoteMode");
  const stackCounts = getTagCounts(jobs, "stack");

  const companyMap = new Map<string, number>();
  for (const job of jobs) {
    companyMap.set(job.company, (companyMap.get(job.company) ?? 0) + 1);
  }
  const companyCounts = Array.from(companyMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const hasActiveFilters =
    !!currentRoleFamily || !!currentSeniority || !!currentRemoteMode || !!currentStack || !!currentCompany || currentSource !== "all";

  return (
    <nav className="space-y-5" aria-label="Job filters">
      {/* Company filter */}
      <CompanyDropdown companies={companyCounts} currentCompany={currentCompany} />

      <div className="border-t border-card-border" />

      {/* Source */}
      <div className="space-y-0.5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-light px-2 mb-1">
          Source
        </h3>
        <FilterRadio
          label="All"
          href={buildHref("source", "")}
          active={currentSource === "all"}
        />
        {SOURCE_OPTIONS.filter((s) => s !== "all").map((s) => (
          <FilterRadio
            key={s}
            label={s}
            href={buildHref("source", s)}
            active={currentSource === s}
          />
        ))}
      </div>

      <div className="border-t border-card-border" />

      {/* Role Family */}
      <FilterGroup
        title="Role"
        items={roleCounts}
        filterKey="role_family"
        currentValue={currentRoleFamily}
        buildHref={buildHref}
      />

      <div className="border-t border-card-border" />

      {/* Seniority */}
      <FilterGroup
        title="Experience"
        items={seniorityCounts}
        filterKey="seniority"
        currentValue={currentSeniority}
        buildHref={buildHref}
      />

      <div className="border-t border-card-border" />

      {/* Remote Mode */}
      <FilterGroup
        title="Work Mode"
        items={remoteModeCounts}
        filterKey="remote_mode"
        currentValue={currentRemoteMode}
        buildHref={buildHref}
      />

      <div className="border-t border-card-border" />

      {/* Tech Stack */}
      <FilterGroup
        title="Tech Stack"
        items={stackCounts}
        filterKey="stack"
        currentValue={currentStack}
        buildHref={buildHref}
      />

      {/* Clear all */}
      {hasActiveFilters && (
        <>
          <div className="border-t border-card-border" />
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover font-medium px-2"
          >
            ✕ Clear all filters
          </Link>
        </>
      )}
    </nav>
  );
}
