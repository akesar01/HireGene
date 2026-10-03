"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, type Recruiter, type Submission } from "@/lib/admin";
import { Button, Card, Empty, ErrorBanner, Notice, fmtDate } from "./AdminUi";

export function SubmissionsPanel({ getToken }: { getToken: () => Promise<string> }) {
  const [items, setItems] = useState<Submission[] | null>(null);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const t = await getToken();
    setItems((await adminApi.submissions(t)).submissions);
  }, [getToken]);

  useEffect(() => {
    load().catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  async function act(id: number, kind: "approve" | "reject") {
    setActionId(id);
    try {
      const t = await getToken();
      if (kind === "approve") await adminApi.approveSubmission(t, id);
      else await adminApi.rejectSubmission(t, id);
      setItems((prev) => prev?.filter((s) => s.id !== id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionId(null);
    }
  }

  if (error) return <ErrorBanner message={error} />;
  if (!items) return <Empty>Loading…</Empty>;
  if (items.length === 0) return <Empty>No pending submissions.</Empty>;

  return (
    <div className="space-y-3">
      {items.map((s) => (
        <Card key={s.id}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">{s.name}</h3>
                {s.company && <span className="text-xs text-muted">@ {s.company}</span>}
              </div>
              {s.title && <p className="text-xs text-muted mt-0.5">{s.title}</p>}
              <a href={s.linkedinUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-xs text-accent hover:underline break-all">
                {s.linkedinUrl}
              </a>
              {s.note && <p className="mt-2 text-xs text-muted bg-surface rounded-lg px-3 py-2">{s.note}</p>}
              <p className="mt-2 text-xs text-muted-light">Submitted {fmtDate(s.submittedAt)}</p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button onClick={() => act(s.id, "approve")} disabled={actionId === s.id}>{actionId === s.id ? "…" : "Approve"}</Button>
              <Button onClick={() => act(s.id, "reject")} disabled={actionId === s.id} variant="secondary">Reject</Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function RecruitersPanel({ getToken }: { getToken: () => Promise<string> }) {
  const [items, setItems] = useState<Recruiter[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const t = await getToken();
    setItems((await adminApi.recruiters(t)).recruiters);
  }, [getToken]);

  useEffect(() => {
    load().catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  async function scrape(id: number) {
    setActionId(id);
    setError("");
    try {
      const t = await getToken();
      const data = await adminApi.scrape(t, id);
      setNotice(
        data.pending
          ? (data.message ?? "Run started in Apify. Listings update after ingest.")
          : `Scrape finished: ${data.jobsCreated ?? 0} new/updated jobs, ${data.jobsSkipped ?? 0} skipped.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scrape failed");
    } finally {
      setActionId(null);
    }
  }

  if (error) return <ErrorBanner message={error} />;
  if (!items) return <Empty>Loading…</Empty>;

  return (
    <div>
      {notice && <Notice message={notice} />}
      {items.length === 0 ? (
        <Empty>No hiring managers being tracked yet.</Empty>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-xs text-muted">
                  <th className="pb-2 pr-4 font-semibold">Name</th>
                  <th className="pb-2 pr-4 font-semibold">Status</th>
                  <th className="pb-2 pr-4 font-semibold">Last scraped</th>
                  <th className="pb-2 pr-4 font-semibold">Added</th>
                  <th className="pb-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b border-border-light">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-foreground">{r.name}</p>
                      <a href={r.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">LinkedIn profile</a>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${r.active ? "bg-green-50 text-green-700" : "bg-surface text-muted"}`}>
                        {r.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted">{r.lastScrapedAt ? fmtDate(r.lastScrapedAt) : "Never"}</td>
                    <td className="py-3 pr-4 text-xs text-muted">{new Date(r.addedAt).toLocaleDateString()}</td>
                    <td className="py-3 text-right">
                      <Button onClick={() => scrape(r.id)} disabled={actionId === r.id}>{actionId === r.id ? "Scraping…" : "Scrape now"}</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
