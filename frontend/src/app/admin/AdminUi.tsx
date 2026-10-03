"use client";

import type { ReactNode } from "react";
import type { SendCounts, VariantStats } from "@/lib/admin";

export function Card({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="bg-card-bg border border-card-border rounded-xl p-5 shadow-card">
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 mb-4">
          {title && <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg bg-surface px-4 py-3 min-w-0">
      <p className="text-xs text-muted truncate">{label}</p>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-light mt-0.5 truncate">{hint}</p>}
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span>{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-xs font-semibold hover:underline">
          Dismiss
        </button>
      )}
    </div>
  );
}

export function Notice({ message }: { message: string }) {
  return <div className="mb-4 rounded-lg border border-card-border bg-surface px-4 py-3 text-sm text-foreground">{message}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-muted">{children}</div>;
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  type?: "button" | "submit";
}) {
  const styles =
    variant === "primary"
      ? "bg-accent text-white hover:bg-accent-hover"
      : variant === "danger"
        ? "bg-red-600 text-white hover:bg-red-700"
        : "border border-card-border text-foreground hover:bg-surface";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

export const inputClass =
  "w-full rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm text-foreground placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20";

export function pct(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

export function fmtDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : "—";
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "completed" || status === "delivered" || status === "sent"
      ? "bg-green-50 text-green-700"
      : status === "running"
        ? "bg-accent-light text-accent"
        : status === "failed" || status === "bounced" || status === "complained"
          ? "bg-red-50 text-red-700"
          : "bg-surface text-muted";
  return <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span>;
}

const COUNT_COLUMNS: { key: keyof SendCounts; label: string }[] = [
  { key: "recipients", label: "Recipients" },
  { key: "delivered", label: "Delivered" },
  { key: "openRate", label: "Open rate" },
  { key: "clickRate", label: "Click rate" },
  { key: "opened", label: "Opened" },
  { key: "clicked", label: "Clicked" },
  { key: "bounced", label: "Bounces" },
  { key: "complained", label: "Complaints" },
  { key: "unsubscribed", label: "Unsubscribes" },
  { key: "skipped", label: "Skipped" },
  { key: "failed", label: "Failed" },
];

function countCell(counts: SendCounts, key: keyof SendCounts): string {
  const value = counts[key];
  if (key === "openRate" || key === "clickRate") return pct(value as number | null);
  return String(value);
}

/** Variant results side by side, with the campaign totals as the first column. */
export function VariantResults({ totals, variants }: { totals: SendCounts; variants: VariantStats[] }) {
  const columns = [{ label: "All", counts: totals, sub: null as string | null }].concat(
    variants.map((v) => ({
      label: `${v.key} · ${v.name}`,
      counts: v.counts,
      sub: v.isHoldout ? `holdout · ${v.weight}% · ${v.counts.holdout} users got nothing` : `${v.weight}%${v.jobCount ? ` · ${v.jobCount} jobs` : ""}`,
    })),
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-card-border text-left text-xs text-muted">
            <th className="pb-2 pr-4 font-semibold">Metric</th>
            {columns.map((c) => (
              <th key={c.label} className="pb-2 pr-4 font-semibold">
                <div className="text-foreground">{c.label}</div>
                {c.sub && <div className="font-normal text-muted-light">{c.sub}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COUNT_COLUMNS.map((col) => (
            <tr key={col.key} className="border-b border-border-light">
              <td className="py-2 pr-4 text-xs text-muted">{col.label}</td>
              {columns.map((c) => (
                <td key={c.label} className="py-2 pr-4 tabular-nums text-foreground">
                  {countCell(c.counts, col.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {totals.dryRun > 0 && (
        <p className="mt-2 text-xs text-muted-light">{totals.dryRun} recorded as dry run (no RESEND_API_KEY at send time); they never reached a provider.</p>
      )}
      {variants.length > 0 && (
        <p className="mt-2 text-xs text-muted-light">Raw counts. Open and click rates divide by emails sent. No significance test is applied.</p>
      )}
    </div>
  );
}
