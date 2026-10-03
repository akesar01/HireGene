"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, type CampaignSummary, type NudgePreview, type NudgeUser, type RunResult, type Schedule } from "@/lib/admin";
import { Button, Card, ErrorBanner, Notice, StatusPill, fmtDate, inputClass } from "./AdminUi";

export default function SendPanel({ getToken }: { getToken: () => Promise<string> }) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [campaignId, setCampaignId] = useState<number | "">("");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<NudgeUser[]>([]);
  const [selected, setSelected] = useState<NudgeUser | null>(null);
  const [preview, setPreview] = useState<NudgePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showText, setShowText] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : "Request failed");

  const loadSchedule = useCallback(async () => {
    const t = await getToken();
    const [s, c] = await Promise.all([adminApi.schedule(t), adminApi.campaigns(t)]);
    setSchedule(s);
    setCampaigns(c.campaigns.filter((x) => x.status !== "completed"));
  }, [getToken]);

  useEffect(() => {
    loadSchedule().catch(fail);
  }, [loadSchedule]);

  useEffect(() => {
    const handle = setTimeout(() => {
      getToken()
        .then((t) => adminApi.users(t, query))
        .then((r) => setUsers(r.users))
        .catch(fail);
    }, 250);
    return () => clearTimeout(handle);
  }, [getToken, query]);

  const selectedCampaign = campaignId === "" ? null : campaignId;

  const loadPreview = useCallback(
    async (user: NudgeUser, campaign: number | null = selectedCampaign) => {
      setSelected(user);
      setPreview(null);
      setPreviewLoading(true);
      try {
        const t = await getToken();
        setPreview(await adminApi.preview(t, user.userId, campaign));
      } catch (e) {
        fail(e);
      } finally {
        setPreviewLoading(false);
      }
    },
    [getToken, selectedCampaign],
  );

  function changeCampaign(value: string) {
    const next = value === "" ? "" : Number(value);
    setCampaignId(next);
    if (selected) loadPreview(selected, next === "" ? null : next);
  }

  async function togglePause() {
    if (!schedule) return;
    setBusy("schedule");
    try {
      const t = await getToken();
      const next = !schedule.paused;
      await adminApi.setSchedulePaused(t, next);
      setSchedule({ ...schedule, paused: next });
      setNotice(next ? "Weekly schedule paused. The cron will create no campaigns until resumed." : "Weekly schedule resumed.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    if (!selected || !testTo.trim()) return;
    setBusy("test");
    setError("");
    try {
      const t = await getToken();
      const result = await adminApi.sendTest(t, { to: testTo.trim(), userId: selected.userId, campaignId: selectedCampaign });
      setNotice(
        result.dryRun
          ? `Dry run: rendered "${result.subject}" for ${testTo}. No RESEND_API_KEY, so nothing was sent.`
          : `Sent "${result.subject}" to ${testTo} (message ${result.providerMessageId ?? "?"}).`,
      );
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function sendNow() {
    const label = selectedCampaign ? campaigns.find((c) => c.id === selectedCampaign)?.name : "a new manual campaign";
    if (!window.confirm(`Send ${label} to every subscribed user now?`)) return;
    setBusy("send");
    setError("");
    try {
      const t = await getToken();
      const result = await adminApi.sendNow(t, selectedCampaign ?? undefined);
      setLastRun(result);
      setNotice(
        `${result.dryRun ? "Dry run" : "Send"} ${result.campaignKey}: ${result.sent} emailed, ${result.skipped} skipped (no jobs), ${result.holdout} holdout, ${result.failed} failed, ${result.inactive} not subscribed` +
          (result.alreadyClaimed > 0 ? `, ${result.alreadyClaimed} already handled by another run` : "") +
          (result.remaining > 0 ? `; ${result.remaining} continue in the background.` : "."),
      );
      await loadSchedule();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} onDismiss={() => setError("")} />}
      {notice && <Notice message={notice} />}

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Weekly schedule">
          {schedule ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <StatusPill status={schedule.paused ? "paused" : "running"} />
                <code className="text-xs text-muted">{schedule.cron} UTC</code>
              </div>
              <p className="text-xs text-muted">{schedule.description}</p>
              <p className="text-xs text-muted">
                Next tick ({fmtDate(schedule.nextTickAt)}) would run: <span className="text-foreground">{schedule.nextTickWouldRun.name}</span> ({schedule.nextTickWouldRun.kind}).
              </p>
              <Button onClick={togglePause} disabled={busy === "schedule"} variant={schedule.paused ? "primary" : "secondary"}>
                {schedule.paused ? "Resume schedule" : "Pause schedule"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted">Loading…</p>
          )}
        </Card>

        <Card title="Send now">
          <div className="space-y-3 text-sm">
            <label className="block text-xs font-medium text-foreground">
              Campaign
              <select value={campaignId} onChange={(e) => changeCampaign(e.target.value)} className={`${inputClass} mt-1`}>
                <option value="">New manual campaign (everyone, default template)</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.kind} · {c.status}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted">
              Sends to every subscribed user who has not already received this campaign. Users with no new matching jobs are skipped. Without a Resend key this records a dry run.
            </p>
            <Button onClick={sendNow} disabled={busy === "send"} variant="danger">
              {busy === "send" ? "Sending…" : "Send now"}
            </Button>
            {lastRun && (
              <p className="text-xs text-muted-light">
                Last run {lastRun.campaignKey}: processed {lastRun.processed}, remaining {lastRun.remaining}
                {lastRun.completed ? ", completed" : ""}.
              </p>
            )}
          </div>
        </Card>
      </div>

      <Card title="Preview a user's email">
        <div className="grid md:grid-cols-[280px_1fr] gap-4">
          <div>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, title…" className={inputClass} />
            <ul className="mt-2 max-h-96 overflow-y-auto divide-y divide-border-light border border-card-border rounded-lg">
              {users.length === 0 && <li className="px-3 py-4 text-xs text-muted">No users with a resume.</li>}
              {users.map((u) => (
                <li key={u.userId}>
                  <button
                    type="button"
                    onClick={() => loadPreview(u)}
                    className={`w-full text-left px-3 py-2 hover:bg-surface ${selected?.userId === u.userId ? "bg-surface" : ""}`}
                  >
                    <p className="text-sm font-semibold text-foreground truncate">{u.name ?? u.email ?? u.userId}</p>
                    <p className="text-xs text-muted truncate">{u.email ?? "no Clerk email"} · {u.currentTitle ?? u.roleFamily ?? "—"}</p>
                    <p className="text-xs text-muted-light">
                      {u.subscribed ? u.frequency : "unsubscribed"}
                      {u.pausedUntil && new Date(u.pausedUntil) > new Date() ? " · paused" : ""}
                      {u.lastSentAt ? ` · last ${new Date(u.lastSentAt).toLocaleDateString()}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0">
            {!selected && <p className="text-sm text-muted">Pick a user to render their email with today&apos;s board.</p>}
            {previewLoading && <p className="text-sm text-muted">Rendering…</p>}
            {preview && !preview.rendered && <Notice message={`Nothing to send: ${preview.reason}`} />}
            {preview?.rendered && (
              <div className="space-y-3">
                <div className="text-sm">
                  <p><span className="text-muted">To:</span> {preview.email ?? "no Clerk email"}</p>
                  <p><span className="text-muted">Subject:</span> <span className="font-semibold text-foreground">{preview.rendered.subject}</span></p>
                  <p className="text-xs text-muted-light">
                    {preview.campaign.key}{preview.variant ? ` · variant ${preview.variant.key}` : ""} · {preview.picks.length} of {preview.poolSize} qualifying jobs
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {preview.picks.map((p) => (
                    <span key={p.id} className="rounded-md bg-surface px-2 py-1">
                      {p.title} · {p.company} · <span className="text-accent font-semibold">{p.matchPercent}%</span>
                      {p.seniorOverride && <span className="text-muted-light"> · relabelled senior</span>}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="secondary" onClick={() => setShowText((v) => !v)}>{showText ? "Show HTML" : "Show plain text"}</Button>
                  <div className="flex items-center gap-2 ml-auto">
                    <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" className={`${inputClass} w-56`} />
                    <Button onClick={sendTest} disabled={busy === "test" || !testTo.trim()}>
                      {busy === "test" ? "Sending…" : "Send test"}
                    </Button>
                  </div>
                </div>
                {showText ? (
                  <pre className="whitespace-pre-wrap text-xs bg-surface rounded-lg p-3 max-h-[600px] overflow-auto">{preview.rendered.text}</pre>
                ) : (
                  <iframe title="Email preview" srcDoc={preview.rendered.html} sandbox="" className="w-full h-[600px] rounded-lg border border-card-border bg-white" />
                )}
                <p className="text-xs text-muted-light">Test sends go to the address you type, prefixed [TEST], carry no working unsubscribe link, and are not recorded as a campaign send. Last sent to this user: {fmtDate(selected?.lastSentAt)}.</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
