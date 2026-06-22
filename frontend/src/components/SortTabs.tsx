import Link from "next/link";
import { SORT_OPTIONS, type SortOption } from "@/lib/data";

interface SortTabsProps {
  currentSort: SortOption;
  buildHref: (key: string, value: string) => string;
}

export default function SortTabs({ currentSort, buildHref }: SortTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-card-border" role="tablist" aria-label="Sort jobs">
      {SORT_OPTIONS.map((s) => {
        const active = currentSort === s;
        return (
          <Link
            key={s}
            href={buildHref("sort", s)}
            role="tab"
            aria-selected={active}
            className={[
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "text-foreground"
                : "text-muted hover:text-foreground",
            ].join(" ")}
          >
            {s}
            {active && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
                aria-hidden="true"
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
