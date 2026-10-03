"use client";

import { useEffect, useState } from "react";
import { adminApi, type SubscriberStats } from "@/lib/admin";
import { Card, Empty, ErrorBanner, StatTile } from "./AdminUi";

export default function SubscribersPanel({ getToken }: { getToken: () => Promise<string> }) {
  const [stats, setStats] = useState<SubscriberStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getToken()
      .then((t) => adminApi.subscribers(t))
      .then(setStats)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [getToken]);

  if (error) return <ErrorBanner message={error} />;
  if (!stats) return <Empty>Loading…</Empty>;

  const reasons = Object.entries(stats.unsubscribeReasons);
  return (
    <div className="space-y-4">
      <Card title="Subscribers">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatTile label="Eligible users" value={stats.eligible} hint="signed in + resume" />
          <StatTile label="Subscribed" value={stats.subscribed} />
          <StatTile label="Paused" value={stats.paused} />
          <StatTile label="Unsubscribed" value={stats.unsubscribed} />
          <StatTile label="New this week" value={stats.newThisWeek} hint="resume uploaded" />
        </div>
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="By frequency">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Weekly" value={stats.byFrequency.weekly} hint="default" />
            <StatTile label="Daily" value={stats.byFrequency.daily} />
          </div>
        </Card>
        <Card title="Unsubscribe reasons">
          {reasons.length === 0 ? (
            <p className="text-sm text-muted">Nobody has unsubscribed.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {reasons.map(([reason, count]) => (
                <li key={reason} className="flex justify-between">
                  <span className="text-muted capitalize">{reason}</span>
                  <span className="tabular-nums text-foreground">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <p className="text-xs text-muted-light">
        Users who never touched the toggle count as subscribed weekly, as the privacy page states.
      </p>
    </div>
  );
}
