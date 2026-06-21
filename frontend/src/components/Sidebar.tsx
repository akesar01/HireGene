import {
  getTagCounts,
  SORT_OPTIONS,
  SOURCE_OPTIONS,
  type SortOption,
  type SourceFilter,
  type TagCount,
  type Job,
} from "@/lib/data";
import FilterPill from "./FilterPill";

function formatLabel(value: string): string {
  return value.replace(/_/g, "-");
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  currentSort: SortOption;
  currentSource: SourceFilter;
  currentRoleFamily: string;
  currentSeniority: string;
  currentRemoteMode: string;
  currentStack: string;
  jobs: Job[];
}

interface FilterState {
  sort: string;
  source: string;
  role_family: string;
  seniority: string;
  remote_mode: string;
  stack: string;
}

// ─── URL Builder ──────────────────────────────────────────────────────────────

function buildHref(state: FilterState, key: string, value: string): string {
  const params = new URLSearchParams();

  for (const [k, v] of Object.entries(state)) {
    if (k === key) {
      // Toggle: same value = deselect, different = select
      if (v !== value) params.set(k, value);
    } else if (v) {
      params.set(k, v);
    }
  }

  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

// ─── Filter Group ─────────────────────────────────────────────────────────────

function FilterGroup({
  items,
  filterKey,
  currentValue,
  state,
}: {
  items: TagCount[];
  filterKey: string;
  currentValue: string;
  state: FilterState;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group">
      {items.map(({ value, count }) => (
        <FilterPill
          key={value}
          label={formatLabel(value)}
          count={count}
          href={buildHref(state, filterKey, value)}
          active={currentValue === value}
        />
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar({
  currentSort,
  currentSource,
  currentRoleFamily,
  currentSeniority,
  currentRemoteMode,
  currentStack,
  jobs,
}: SidebarProps) {
  const state: FilterState = {
    sort: currentSort,
    source: currentSource !== "all" ? currentSource : "",
    role_family: currentRoleFamily,
    seniority: currentSeniority,
    remote_mode: currentRemoteMode,
    stack: currentStack,
  };

  const roleCounts = getTagCounts(jobs, "roleFamily");
  const seniorityCounts = getTagCounts(jobs, "seniority");
  const remoteModeCounts = getTagCounts(jobs, "remoteMode");
  const stackCounts = getTagCounts(jobs, "stack");

  return (
    <nav className="space-y-3" aria-label="Job filters">
      {/* Sort + Source */}
      <div className="flex flex-wrap gap-1.5 items-center" role="group" aria-label="Sort and source">
        {SORT_OPTIONS.map((s) => (
          <FilterPill
            key={s}
            label={s}
            href={buildHref(state, "sort", s)}
            active={currentSort === s}
          />
        ))}
        <span className="mx-1 text-border select-none" aria-hidden="true">|</span>
        {SOURCE_OPTIONS.map((s) => (
          <FilterPill
            key={s}
            label={s}
            href={buildHref(state, "source", s === "all" ? "" : s)}
            active={currentSource === s}
          />
        ))}
      </div>

      {/* Faceted filters */}
      <FilterGroup items={roleCounts} filterKey="role_family" currentValue={currentRoleFamily} state={state} />
      <FilterGroup items={seniorityCounts} filterKey="seniority" currentValue={currentSeniority} state={state} />
      <FilterGroup items={remoteModeCounts} filterKey="remote_mode" currentValue={currentRemoteMode} state={state} />
      <FilterGroup items={stackCounts} filterKey="stack" currentValue={currentStack} state={state} />
    </nav>
  );
}
