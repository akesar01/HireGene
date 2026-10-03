"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, type CampaignStats, type CampaignVariantInput } from "@/lib/admin";
import { Button, Card, Empty, ErrorBanner, Notice, StatusPill, VariantResults, fmtDate, inputClass } from "./AdminUi";

type Draft = Omit<CampaignVariantInput, "weight" | "jobCount"> & { weight: string; jobCount: string };

const emptyVariant = (key: string, name: string, weight: string): Draft => ({
  key,
  name,
  weight,
  isHoldout: false,
  subject: "",
  intro: "",
  jobCount: "",
});

export default function ExperimentsPanel({ getToken }: { getToken: () => Promise<string> }) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignStats[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [jobCount, setJobCount] = useState("5");
  const [variants, setVariants] = useState<Draft[]>([
    emptyVariant("A", "Default subject", "45"),
    emptyVariant("B", "Alternative subject", "45"),
    { ...emptyVariant("control", "Holdout (no email)", "10"), isHoldout: true },
  ]);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : "Request failed");

  const load = useCallback(async () => {
    const t = await getToken();
    const s = await adminApi.email(t);
    const experiments = s.campaigns.filter((c) => c.kind === "experiment");
    setCampaigns(experiments);
    setOpen((prev) => prev ?? experiments[0]?.id ?? null);
  }, [getToken]);

  useEffect(() => {
    load().catch(fail);
  }, [load]);

  const weightTotal = variants.reduce((sum, v) => sum + (Number(v.weight) || 0), 0);

  function update(index: number, patch: Partial<Draft>) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  async function create() {
    setBusy("create");
    setError("");
    try {
      const t = await getToken();
      const body = {
        name,
        jobCount: Number(jobCount) || 5,
        variants: variants.map((v) => ({
          key: v.key.trim(),
          name: v.name.trim(),
          weight: Number(v.weight),
          isHoldout: v.isHoldout,
          subject: v.isHoldout ? null : v.subject?.trim() || null,
          intro: v.isHoldout ? null : v.intro?.trim() || null,
          jobCount: v.isHoldout || !v.jobCount ? null : Number(v.jobCount),
        })),
      };
      const { campaign } = await adminApi.createCampaign(t, body);
      setNotice(`Created "${campaign.name}" (${campaign.key}). It is a draft until you run it.`);
      setName("");
      await load();
      setOpen(campaign.id);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function run(campaign: CampaignStats) {
    if (!window.confirm(`Run "${campaign.name}" now? Recipients are split ${campaign.variants.map((v) => `${v.key} ${v.weight}%`).join(", ")}.`)) return;
    setBusy(`run-${campaign.id}`);
    setError("");
    try {
      const t = await getToken();
      const result = await adminApi.sendNow(t, campaign.id);
      setNotice(
        `${result.dryRun ? "Dry run" : "Run"} ${result.campaignKey}: ${result.sent} emailed, ${result.holdout} holdout, ${result.skipped} skipped, ${result.failed} failed` +
          (result.alreadyClaimed > 0 ? `, ${result.alreadyClaimed} already handled by another run` : "") +
          (result.remaining > 0 ? `; ${result.remaining} continue in the background.` : "."),
      );
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  const selected = campaigns.find((c) => c.id === open) ?? null;

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} onDismiss={() => setError("")} />}
      {notice && <Notice message={notice} />}

      <Card title="New experiment">
        <div className="grid md:grid-cols-[1fr_120px] gap-3 mb-4">
          <label className="text-xs font-medium text-foreground">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Subject line test, October" className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs font-medium text-foreground">
            Jobs per email
            <input value={jobCount} onChange={(e) => setJobCount(e.target.value)} inputMode="numeric" className={`${inputClass} mt-1`} />
          </label>
        </div>
        <div className="space-y-3">
          {variants.map((v, i) => (
            <div key={i} className="rounded-lg border border-card-border p-3 grid md:grid-cols-[80px_1fr_90px_auto] gap-3 items-start">
              <label className="text-xs font-medium text-foreground">
                Key
                <input value={v.key} onChange={(e) => update(i, { key: e.target.value })} className={`${inputClass} mt-1`} />
              </label>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-foreground">
                  Name
                  <input value={v.name} onChange={(e) => update(i, { name: e.target.value })} className={`${inputClass} mt-1`} />
                </label>
                {!v.isHoldout && (
                  <>
                    <label className="block text-xs font-medium text-foreground">
                      Subject <span className="text-muted-light font-normal">(blank = default; {"{count} {companies} {name}"} allowed)</span>
                      <input value={v.subject ?? ""} onChange={(e) => update(i, { subject: e.target.value })} className={`${inputClass} mt-1`} />
                    </label>
                    <label className="block text-xs font-medium text-foreground">
                      Intro copy <span className="text-muted-light font-normal">(blank = default)</span>
                      <textarea value={v.intro ?? ""} onChange={(e) => update(i, { intro: e.target.value })} rows={2} className={`${inputClass} mt-1`} />
                    </label>
                    <label className="block text-xs font-medium text-foreground">
                      Jobs in this variant <span className="text-muted-light font-normal">(blank = campaign default)</span>
                      <input value={v.jobCount} onChange={(e) => update(i, { jobCount: e.target.value })} inputMode="numeric" className={`${inputClass} mt-1 w-28`} />
                    </label>
                  </>
                )}
              </div>
              <label className="text-xs font-medium text-foreground">
                Weight %
                <input value={v.weight} onChange={(e) => update(i, { weight: e.target.value })} inputMode="numeric" className={`${inputClass} mt-1`} />
              </label>
              <div className="flex flex-col gap-2 pt-5">
                <label className="flex items-center gap-2 text-xs text-foreground">
                  <input type="checkbox" checked={v.isHoldout} onChange={(e) => update(i, { isHoldout: e.target.checked })} />
                  Holdout
                </label>
                <button type="button" onClick={() => setVariants((prev) => prev.filter((_, j) => j !== i))} className="text-xs text-muted hover:text-red-600">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => setVariants((prev) => [...prev, emptyVariant(String.fromCharCode(65 + prev.length), "", "0")])}>
            Add variant
          </Button>
          <span className={`text-xs ${weightTotal === 100 ? "text-muted" : "text-red-600"}`}>Weights total {weightTotal}% (must be 100)</span>
          <div className="ml-auto">
            <Button onClick={create} disabled={busy === "create" || !name.trim() || weightTotal !== 100 || variants.length < 2}>
              {busy === "create" ? "Creating…" : "Create experiment"}
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-light">
          Each user is assigned to one arm by a hash of campaign and user id, so re-runs never flip anyone. Holdout users get nothing and appear only in the counts.
        </p>
      </Card>

      <Card title="Experiments">
        {campaigns.length === 0 ? (
          <Empty>No experiments yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-xs text-muted">
                  <th className="pb-2 pr-4 font-semibold">Experiment</th>
                  <th className="pb-2 pr-4 font-semibold">Status</th>
                  <th className="pb-2 pr-4 font-semibold">Arms</th>
                  <th className="pb-2 pr-4 font-semibold">Assigned</th>
                  <th className="pb-2 pr-4 font-semibold">Created</th>
                  <th className="pb-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className={`border-b border-border-light ${open === c.id ? "bg-surface" : ""}`}>
                    <td className="py-2 pr-4">
                      <button type="button" onClick={() => setOpen(c.id)} className="text-left font-semibold text-foreground hover:underline">{c.name}</button>
                      <p className="text-xs text-muted-light">{c.key}</p>
                    </td>
                    <td className="py-2 pr-4"><StatusPill status={c.status} /></td>
                    <td className="py-2 pr-4 text-xs text-muted">{c.variants.map((v) => `${v.key} ${v.weight}%${v.isHoldout ? " (holdout)" : ""}`).join(" · ")}</td>
                    <td className="py-2 pr-4 tabular-nums">{c.totals.recipients + c.totals.holdout}</td>
                    <td className="py-2 pr-4 text-xs text-muted">{fmtDate(c.createdAt)}</td>
                    <td className="py-2 text-right">
                      {c.status !== "completed" && (
                        <Button onClick={() => run(c)} disabled={busy === `run-${c.id}`} variant="danger">
                          {busy === `run-${c.id}` ? "Running…" : c.status === "running" ? "Continue" : "Run now"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <Card title={`Results: ${selected.name}`}>
          <VariantResults totals={selected.totals} variants={selected.variants} />
          <div className="mt-4 grid md:grid-cols-3 gap-3 text-xs text-muted">
            {selected.variants.map((v) => (
              <div key={v.id} className="rounded-lg bg-surface p-3">
                <p className="font-semibold text-foreground">{v.key} · {v.name}</p>
                {v.isHoldout ? <p>Receives nothing.</p> : (
                  <>
                    <p>Subject: {v.subject ?? <em>default</em>}</p>
                    <p>Intro: {v.intro ?? <em>default</em>}</p>
                    <p>Jobs: {v.jobCount ?? selected.jobCount}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
