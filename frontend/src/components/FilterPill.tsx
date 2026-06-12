import Link from "next/link";

interface FilterPillProps {
  label: string;
  count?: number;
  href: string;
  active?: boolean;
}

export default function FilterPill({
  label,
  count,
  href,
  active = false,
}: FilterPillProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "inline-block rounded-md px-2.5 py-1 text-xs leading-5 transition-all duration-150",
        active
          ? "bg-chip-bg-active text-chip-text-active font-semibold shadow-sm"
          : "bg-chip-bg text-chip-text hover:bg-surface-hover hover:text-foreground hover:shadow-sm",
      ].join(" ")}
    >
      {label}
      {count !== undefined && (
        <span className={active ? "ml-0.5 opacity-70" : "ml-0.5 opacity-50"}>
          ({count})
        </span>
      )}
    </Link>
  );
}
