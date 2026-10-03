// Deterministic tag-overlap match score. Backend port of
// frontend/src/lib/match.ts for the email send path (no LLM, no I/O).
//
// The stack term is included whenever either side lists a stack, exactly as
// on the site. One deliberate difference from the frontend: a job with no
// stack tags gets neutral half credit (20/40) on that term instead of 0/40.
// Scoring it 0 buried otherwise good matches (the Zepto, Microsoft and Zomato
// rows in the design snapshot); leaving the term out entirely would rank
// "unknown stack" above a real partial overlap. Every other input scores the
// same here as on the site.

function norm(value: string): string {
  return value.toLowerCase().replace(/[-.]/g, "_").trim();
}

const SENIORITY_ADJACENT: Record<string, string[]> = {
  intern: ["junior"],
  junior: ["intern", "mid"],
  mid: ["junior", "senior"],
  senior: ["mid", "lead"],
  lead: ["senior", "staff"],
  staff: ["lead", "head"],
  head: ["staff"],
};

export function isAdjacentSeniority(a: string, b: string): boolean {
  return SENIORITY_ADJACENT[norm(a)]?.includes(norm(b)) ?? false;
}

export interface MatchProfile {
  roleFamily: string;
  seniority: string;
  remoteMode: string;
  stack: string[];
}

export interface MatchJob {
  roleFamily: string;
  seniority: string;
  remoteMode: string;
  stack: string[];
}

/** 0-100. Stack 40, role family 30, seniority 20 (10 when adjacent), remote mode 10. */
export function computeTagOverlapScore(job: MatchJob, profile: MatchProfile): number {
  let score = 0;
  let maxScore = 0;

  const profileStack = (profile.stack ?? []).map(norm);
  const jobStack = (job.stack ?? []).map(norm);

  if (profileStack.length > 0 || jobStack.length > 0) {
    maxScore += 40;
    if (jobStack.length === 0) {
      score += 20;
    } else {
      const overlap = jobStack.filter((s) => profileStack.includes(s)).length;
      const denominator = Math.max(profileStack.length, jobStack.length);
      score += (40 * overlap) / denominator;
    }
  }

  if (profile.roleFamily) {
    maxScore += 30;
    if (norm(job.roleFamily) === norm(profile.roleFamily)) score += 30;
  }

  if (profile.seniority) {
    maxScore += 20;
    if (norm(job.seniority) === norm(profile.seniority)) score += 20;
    else if (isAdjacentSeniority(profile.seniority, job.seniority)) score += 10;
  }

  if (profile.remoteMode) {
    maxScore += 10;
    if (norm(job.remoteMode) === norm(profile.remoteMode)) score += 10;
  }

  if (maxScore === 0) return 0;
  return Math.round((score / maxScore) * 100);
}
