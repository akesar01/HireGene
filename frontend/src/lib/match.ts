import type { Job } from "./data";
import type { FilterSummary } from "./profile";

// Normalize enum values: frontend uses hyphens/dots (ai-ml, next.js, in-office)
// backend uses underscores/no dots (ai_ml, nextjs, in_office).
// This function converts both to a common format for comparison.
function norm(v: string): string {
  return v.toLowerCase().replace(/[-.]/g, "_").trim();
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

export function computeTagOverlapScore(job: Job, profile: FilterSummary): number {
  let score = 0;
  let maxScore = 0;

  const profileStack = profile.stack.map(norm);
  const jobStack = job.stack.map(norm);

  // Stack overlap (40%)
  if (profileStack.length > 0 || jobStack.length > 0) {
    maxScore += 40;
    const overlap = jobStack.filter((s) => profileStack.includes(s)).length;
    const denominator = Math.max(profileStack.length, jobStack.length);
    if (denominator > 0) {
      score += 40 * overlap / denominator;
    }
  }

  // Role family (30%)
  if (profile.roleFamily) {
    maxScore += 30;
    if (norm(job.roleFamily) === norm(profile.roleFamily)) {
      score += 30;
    }
  }

  // Seniority (20%)
  if (profile.seniority) {
    maxScore += 20;
    if (norm(job.seniority) === norm(profile.seniority)) {
      score += 20;
    } else if (isAdjacentSeniority(profile.seniority, job.seniority)) {
      score += 10;
    }
  }

  // Remote mode (10%)
  if (profile.remoteMode) {
    maxScore += 10;
    if (norm(job.remoteMode) === norm(profile.remoteMode)) {
      score += 10;
    }
  }

  if (maxScore === 0) return 0;
  return Math.round((score / maxScore) * 100);
}
