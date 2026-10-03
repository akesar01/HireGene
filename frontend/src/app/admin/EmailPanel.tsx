"use client";

import { useEffect, useState } from "react";
import { adminApi, type EmailStats } from "@/lib/admin";
import { Card, Empty, ErrorBanner, StatusPill, VariantResults, fmtDate } from "./AdminUi";

export default function EmailPanel({ getToken }: { getToken: () => Promise<string> }) {
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    getToken()
      .then((t) => adminApi.email(t))
      .then((s) => {
        setStats(s);
        setOpen(s.campaigns[0]?.id ?? null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [getToken]);

  if (error) return <ErrorBanner message={error} />;
  if (!stats) return <Empty>Loading…</Empty>;

  return (
    <div className="space-y-4">
      <Card title="Campaigns">
        {stats.campaigns.length === 0 ? (
          <Empty>No campaigns yet. The first weekly send creates one, or use Send now.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-xs text-muted">
                  <th className="pb-2 pr-4 font-semibold">Campaign</th>
                  <th className="pb-2 pr-4 font-semibold">Status</th>
                  <th className="pb-2 pr-4 font-semibold">Recipients</th>
                  <th className="pb-2 pr-4 font-semibold">Delivered</th>
                  <th className="pb-2 pr-4 font-semibold">Open</th>
                  <th className="pb-2 pr-4 font-semibold">Click</th>
                  <th className="pb-2 pr-4 font-semibold">Bounce / Complaint</th>
                  <th className="pb-2 pr-4 font-semibold">Unsub</th>
                  <th className="pb-2 font-semibold">Started</th>
                </tr>
              </thead>
              <tbody>
                {stats.campaigns.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setOpen(open === c.id ? null : c.id)}
                    className={`border-b border-border-light cursor-pointer hover:bg-surface ${open === c.id ? "bg-surface" : ""}`}
                  >
                    <td className="py-2 pr-4">
                      <p className="font-semibold text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-light">{c.key} · {c.kind}{c.variants.length ? ` · ${c.variants.length} variants` : ""}</p>
                    </td>
                    <td className="py-2 pr-4"><StatusPill status={c.status} /></td>
                    <td className="py-2 pr-4 tabular-nums">{c.totals.recipients}</td>
                    <td className="py-2 pr-4 tabular-nums">{c.totals.delivered}</td>
                    <td className="py-2 pr-4 tabular-nums">{c.totals.openRate === null ? "—" : `${c.totals.openRate}%`}</td>
                    <td className="py-2 pr-4 tabular-nums">{c.totals.clickRate === null ? "—" : `${c.totals.clickRate}%`}</td>
                    <td className="py-2 pr-4 tabular-nums">{c.totals.bounced} / {c.totals.complained}</td>
                    <td className="py-2 pr-4 tabular-nums">{c.totals.unsubscribed}</td>
                    <td className="py-2 text-xs text-muted">{fmtDate(c.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open !== null && stats.campaigns.find((c) => c.id === open) && (
        <Card title={`Breakdown: ${stats.campaigns.find((c) => c.id === open)!.name}`}>
          <VariantResults
            totals={stats.campaigns.find((c) => c.id === open)!.totals}
            variants={stats.campaigns.find((c) => c.id === open)!.variants}
          />
        </Card>
      )}

      <Card title="Top clicked jobs (all campaigns)">
        {stats.topClickedJobs.length === 0 ? (
          <p className="text-sm text-muted">No clicks recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {stats.topClickedJobs.map((j) => (
                <tr key={j.jobId} className="border-b border-border-light">
                  <td className="py-2 pr-4">
                    <span className="font-semibold text-foreground">{j.title ?? `Job #${j.jobId}`}</span>
                    {j.company && <span className="text-muted"> · {j.company}</span>}
                  </td>
                  <td className="py-2 text-right tabular-nums">{j.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
