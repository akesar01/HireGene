import Link from "next/link";

interface FilterRadioProps {
  label: string;
  count?: number;
  href: string;
  active?: boolean;
}

export default function FilterRadio({
  label,
  count,
  href,
  active = false,
}: FilterRadioProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
        active
          ? "text-foreground font-medium"
          : "text-muted hover:text-foreground hover:bg-surface",
      ].join(" ")}
    >
      <span
        className={[
          "w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
          active ? "border-accent" : "border-border",
        ].join(" ")}
        aria-hidden="true"
      >
        {active && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-xs text-muted-light tabular-nums">{count}</span>
      )}
    </Link>
  );
}
