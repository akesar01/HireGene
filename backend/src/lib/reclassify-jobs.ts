// Decide keep/delete for existing Job rows using the deterministic ingest
// gates. Pure: no Prisma, no LLM. Driven by scripts/reclassify-jobs.ts.

import { evaluateJobGates, findNearDuplicate, type IngestSkipReason } from "./ingest-gates.js";

export interface StoredJob {
  id: number;
  recruiterId: number;
  title: string;
  company: string;
  roleFamily: string;
  authorTitle: string;
  rawText: string;
  postedAt: Date;
}

export type JobDecision =
  | { id: number; action: "keep"; fix?: { title?: string; company?: string } }
  | { id: number; action: "delete"; reason: Extract<IngestSkipReason, "off_target" | "unparseable" | "duplicate">; detail: string };

/**
 * Jobs are processed oldest-first per recruiter so the first posting of a
 * role survives and later near-duplicates are the ones deleted.
 */
export function decideJobs(jobs: StoredJob[], env: NodeJS.ProcessEnv = process.env): JobDecision[] {
  const ordered = [...jobs].sort(
    (a, b) =>
      a.recruiterId - b.recruiterId ||
      a.postedAt.getTime() - b.postedAt.getTime() ||
      a.id - b.id,
  );
  const kept = new Map<number, Array<{ id: number; title: string; company: string; postedAt: Date }>>();
  const decisions: JobDecision[] = [];

  for (const job of ordered) {
    const gate = evaluateJobGates(job, env);
    if (!gate.ok) {
      decisions.push({ id: job.id, action: "delete", reason: gate.reason, detail: gate.detail });
      continue;
    }

    const siblings = kept.get(job.recruiterId) ?? [];
    const duplicateOf = findNearDuplicate(
      { title: gate.title, company: gate.company, postedAt: job.postedAt },
      siblings,
    );
    if (duplicateOf) {
      decisions.push({
        id: job.id,
        action: "delete",
        reason: "duplicate",
        detail: `near-duplicate of job #${duplicateOf.id}`,
      });
      continue;
    }

    const fix: { title?: string; company?: string } = {};
    if (gate.title !== job.title) fix.title = gate.title;
    if (gate.company !== job.company) fix.company = gate.company;
    decisions.push({ id: job.id, action: "keep", ...(Object.keys(fix).length > 0 ? { fix } : {}) });
    siblings.push({ id: job.id, title: gate.title, company: gate.company, postedAt: job.postedAt });
    kept.set(job.recruiterId, siblings);
  }

  return decisions;
}

export function describeDecision(decision: JobDecision, job: StoredJob): string {
  if (decision.action === "delete") return `${decision.reason}: ${decision.detail}`;
  if (!decision.fix) return "ok";
  const parts: string[] = [];
  if (decision.fix.title !== undefined) parts.push(`title "${job.title}" -> "${decision.fix.title}"`);
  if (decision.fix.company !== undefined) parts.push(`company "${job.company}" -> "${decision.fix.company}"`);
  return `ok, fix ${parts.join(", ")}`;
}
