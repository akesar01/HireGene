"use client";

export interface FeedFilters {
  country: string;
  roleFamily: string;
  seniority: string;
  remoteMode: string;
  company: string;
}

interface FilterBarProps {
  filters: FeedFilters;
  roles: string[];
  seniorities: string[];
  remoteModes: string[];
  companies: string[];
  resultCount: number;
  totalCount: number;
  onChange: (key: keyof FeedFilters, value: string) => void;
  onClear: () => void;
}

function pretty(value: string): string {
  const special: Record<string, string> = {
    india: "India",
    us: "United States",
    "ai-ml": "AI / ML",
    ai_ml: "AI / ML",
    "in-office": "In office",
    in_office: "In office",
    "founders-office": "Founders office",
    founders_office: "Founders office",
    mid: "Mid-level",
  };
  if (special[value]) return special[value];
  return value.replace(/[_-]/g, " ");
}

function Select({
  label,
  value,
  emptyLabel,
  options,
  onChange,
}: {
  label: string;
  value: string;
  emptyLabel: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[11px] font-semibold text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "w-full cursor-pointer rounded-lg border bg-surface px-3 py-2 text-sm text-foreground",
          "focus:border-accent focus:outline-none",
          value ? "border-accent/40" : "border-card-border",
        ].join(" ")}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {pretty(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function FilterBar({
  filters,
  roles,
  seniorities,
  remoteModes,
  companies,
  resultCount,
  totalCount,
  onChange,
  onClear,
}: FilterBarProps) {
  const active = Boolean(
    filters.country || filters.roleFamily || filters.seniority || filters.remoteMode || filters.company,
  );

  return (
    <div className="mb-5 rounded-xl border border-card-border bg-card-bg p-3 shadow-card sm:p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Select
          label="Country"
          value={filters.country}
          emptyLabel="Any country"
          options={["india", "us"]}
          onChange={(value) => onChange("country", value)}
        />
        <Select
          label="Role"
          value={filters.roleFamily}
          emptyLabel="Any role"
          options={roles}
          onChange={(value) => onChange("roleFamily", value)}
        />
        <Select
          label="Experience"
          value={filters.seniority}
          emptyLabel="Any level"
          options={seniorities}
          onChange={(value) => onChange("seniority", value)}
        />
        <Select
          label="Work"
          value={filters.remoteMode}
          emptyLabel="Any workplace"
          options={remoteModes}
          onChange={(value) => onChange("remoteMode", value)}
        />
        <Select
          label="Company"
          value={filters.company}
          emptyLabel="Any company"
          options={companies}
          onChange={(value) => onChange("company", value)}
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {active ? `${resultCount} of ${totalCount} jobs` : `${totalCount} jobs`}
        </p>
        {active && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-semibold text-accent hover:text-accent-hover"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
