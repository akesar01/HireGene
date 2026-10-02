"use client";

import { useEffect, useState } from "react";
import { adminApi, type JobStats } from "@/lib/admin";
import { Card, Empty, ErrorBanner, StatTile, fmtDate } from "./AdminUi";

const LEVELS = ["intern", "junior", "mid", "senior", "lead", "staff", "head"];

export default function JobsPanel({ getToken }: { getToken: () => Promise<string> }) {
  const [stats, setStats] = useState<JobStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getToken()
      .then((t) => adminApi.jobs(t, 14))
      .then(setStats)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [getToken]);

  if (error) return <ErrorBanner message={error} />;
  if (!stats) return <Empty>Loading…</Empty>;

  const levelsPresent = LEVELS.filter((l) => stats.addedPerDay.some((d) => d.byLevel[l]) || stats.liveByLevel[l]);

  return (
    <div className="space-y-4">
      <Card title="Live jobs">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatTile label="Live jobs" value={stats.liveJobs} hint="unexpired" />
          {levelsPresent.slice(0, 4).map((l) => (
            <StatTile key={l} label={l} value={stats.liveByLevel[l] ?? 0} />
          ))}
        </div>
      </Card>

      <Card title="Jobs added per day (last 14 days, by ingest date)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-xs text-muted">
                <th className="pb-2 pr-4 font-semibold">Day</th>
                <th className="pb-2 pr-4 font-semibold">Total</th>
                {levelsPresent.map((l) => (
                  <th key={l} className="pb-2 pr-4 font-semibold capitalize">{l}</th>
                ))}
                <th className="pb-2 pr-4 font-semibold">LinkedIn</th>
                <th className="pb-2 font-semibold">X</th>
              </tr>
            </thead>
            <tbody>
              {stats.addedPerDay.map((d) => (
                <tr key={d.day} className="border-b border-border-light">
                  <td className="py-1.5 pr-4 text-xs text-muted">{d.day}</td>
                  <td className="py-1.5 pr-4 tabular-nums font-semibold">{d.total}</td>
                  {levelsPresent.map((l) => (
                    <td key={l} className="py-1.5 pr-4 tabular-nums">{d.byLevel[l] ?? 0}</td>
                  ))}
                  <td className="py-1.5 pr-4 tabular-nums">{d.bySource.linkedin ?? 0}</td>
                  <td className="py-1.5 tabular-nums">{d.bySource.x ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Live jobs per hiring manager">
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {stats.perRecruiter.map((r) => (
                  <tr key={r.recruiterId} className="border-b border-border-light">
                    <td className="py-1.5 pr-4">
                      <span className="font-semibold text-foreground">{r.name}</span>
                      {!r.active && <span className="ml-2 text-xs text-muted-light">inactive</span>}
                      <p className="text-xs text-muted-light">scraped {fmtDate(r.lastScrapedAt)}</p>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{r.liveJobs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title={`Job clicks from emails (${stats.totalEmailClicks} total)`}>
          {stats.jobClicks.length === 0 ? (
            <p className="text-sm text-muted">No email clicks yet. Site clicks are not tracked (no custom analytics events).</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {stats.jobClicks.map((j) => (
                  <tr key={j.jobId} className="border-b border-border-light">
                    <td className="py-1.5 pr-4">
                      <span className="font-semibold text-foreground">{j.title ?? `Job #${j.jobId}`}</span>
                      {j.company && <span className="text-muted"> · {j.company}</span>}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{j.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
