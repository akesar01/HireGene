// Pure selection and labelling for match-based email nudges.
// No Prisma, no Mongo, no LLM: everything here is unit-testable with fixtures.

import { evaluateJobGates } from "./ingest-gates.js";
import { isJobExpired } from "./job-expiry.js";
import { computeTagOverlapScore, type MatchProfile } from "./match-score.js";

export interface NudgeJobInput {
  id: number;
  title: string;
  company: string;
  author: string;
  authorTitle: string;
  source: string;
  sourceUrl: string;
  roleFamily: string;
  seniority: string;
  remoteMode: string;
  stack: string[];
  description: string[];
  rawText?: string | null;
  postedAt: Date;
  createdAt: Date;
}

export type PosterKind = "Hiring manager" | "Engineer (referral)" | "Recruiter";

export interface RankedJob {
  id: number;
  title: string;
  company: string;
  author: string;
  authorTitle: string;
  sourceUrl: string;
  source: string;
  roleFamily: string;
  /** Stored seniority after the senior-title/years override. */
  seniority: string;
  storedSeniority: string;
  seniorOverride: boolean;
  levelLabel: string;
  remoteMode: string;
  remoteLabel: string;
  stack: string[];
  posterKind: PosterKind;
  posterLine: string;
  bullets: string[];
  postedAt: Date;
  createdAt: Date;
  matchPercent: number;
  isNew: boolean;
}

// ─── Senior override ─────────────────────────────────────────────────────────

const SENIOR_TITLE_RE =
  /\bSDE[\s-]?(?:3|III|4|IV)\b|\bSE[\s-]?(?:3|III)\b|\bL[5-9]\b|\bsenior\b|\bsr\.?\s|\bsr\.?$|\bstaff\b|\blead\b|\bprincipal\b|\barchitect\b|\bmanager\b|\bhead\s+of\b|\bdirector\b/i;

// A years figure counts only as an "N+" form or beside an experience cue in
// the same clause: "5+ years", "7-12 YOE", "minimum 6 yrs", "at least 5 years
// of experience". "a fintech with 12 years in market" does not count.
const YEARS_RE =
  /(?<![\d.])(\d{1,2}(?:\.\d+)?)\s*(\+)?(?:\s*(?:-|–|to)\s*(\d{1,2}(?:\.\d+)?))?\s*(\+)?\s*(?:years?|yrs?|yoe)\b/gi;
const EXPERIENCE_CUE_RE = /\bexperience|\bexp\b|\byoe\b|\bminimum\b|\bmin\b|\bat\s?least\b/i;
const ABBREVIATION_PERIOD_RE = /\b(exp|min|yrs?)\.(?=\s|$)/gi;
const CLAUSE_BREAK_RE = /\.(?=\s|$)|[;|\n•·]/;

export const SENIOR_YEARS_MIN = 5;

/** Smallest stated years-of-experience figure in the text, or null. */
export function minimumYears(text: string): number | null {
  let min: number | null = null;
  for (const clause of text.replace(ABBREVIATION_PERIOD_RE, "$1").split(CLAUSE_BREAK_RE)) {
    const cued = EXPERIENCE_CUE_RE.test(clause);
    for (const match of clause.matchAll(YEARS_RE)) {
      const years = Number(match[1]);
      if (!Number.isFinite(years) || years > 40) continue;
      if (!cued && !match[2] && !match[4]) continue;
      min = min === null ? years : Math.min(min, years);
    }
  }
  return min;
}

export function isSeniorByTitle(title: string): boolean {
  return SENIOR_TITLE_RE.test(title);
}

/** True when the title or bullets say this is a senior role. */
export function isSeniorRole(job: Pick<NudgeJobInput, "title" | "description">): boolean {
  if (isSeniorByTitle(job.title)) return true;
  const years = minimumYears([job.title, ...(job.description ?? [])].join("\n"));
  return years !== null && years >= SENIOR_YEARS_MIN;
}

const JUNIOR_LEVELS = new Set(["intern", "junior", "mid"]);

/** Stored seniority, lifted to "senior" when the title or years say so. */
export function effectiveSeniority(job: Pick<NudgeJobInput, "title" | "description" | "seniority">): string {
  const stored = (job.seniority ?? "").toLowerCase();
  if (JUNIOR_LEVELS.has(stored) && isSeniorRole(job)) return "senior";
  return stored;
}

const LEVEL_LABELS: Record<string, string> = {
  intern: "Intern / Fresher",
  junior: "SDE-1 level",
  mid: "SDE-2 level",
  senior: "Senior / SDE-3+",
  lead: "Lead",
  staff: "Staff",
  head: "Head",
};

export function levelLabel(seniority: string): string {
  return LEVEL_LABELS[seniority.toLowerCase()] ?? seniority;
}

const REMOTE_LABELS: Record<string, string> = {
  in_office: "In-office",
  remote: "Remote",
  hybrid: "Hybrid",
};

export function remoteLabel(remoteMode: string): string {
  return REMOTE_LABELS[remoteMode.toLowerCase()] ?? remoteMode;
}

// ─── Poster labelling ────────────────────────────────────────────────────────

const RECRUITER_RE = /\btalent\b|\brecruit|\bhr\b|\bhuman resources\b|\bstaffing\b|\bsourcing\b|\bpeople (?:ops|operations|partner)\b|\bconsultant\b/i;
const HIRING_MANAGER_RE =
  /\bmanager\b|\bhead\b|\blead\b|\bfounder\b|\bco-?founder\b|\bcto\b|\bceo\b|\bcoo\b|\bdirector\b|\bvp\b|\bvice president\b|\bbuilding\b|\bowner\b/i;
const ENGINEER_RE = /\bengineer|\bsde\b|\bdeveloper\b|\bprogrammer\b|\bswe\b/i;

export function posterKind(authorTitle: string): PosterKind {
  const headline = authorTitle ?? "";
  if (RECRUITER_RE.test(headline)) return "Recruiter";
  if (HIRING_MANAGER_RE.test(headline)) return "Hiring manager";
  if (ENGINEER_RE.test(headline)) return "Engineer (referral)";
  return "Recruiter";
}

const ROLE_WORD_RE =
  /engineer|manager|head|lead|founder|cto|ceo|coo|director|recruit|talent|developer|sde|hiring|\bhr\b|architect|\bvp\b|president|scientist|analyst|product|designer|building|owner/i;

export const POSTER_LINE_MAX = 60;

/** First "|" segment of the headline, or the first segment with a role word. */
export function posterLine(authorTitle: string): string {
  const segments = (authorTitle ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return "";
  let chosen = segments[0];
  if (!ROLE_WORD_RE.test(chosen)) {
    const withRole = segments.find((s) => ROLE_WORD_RE.test(s));
    if (withRole) chosen = withRole;
  }
  if (chosen.length <= POSTER_LINE_MAX) return chosen;
  return `${chosen.slice(0, POSTER_LINE_MAX - 1).trimEnd()}…`;
}

// ─── Bullets ─────────────────────────────────────────────────────────────────

const LOCATION_RE =
  /bangalore|bengaluru|hyderabad|pune|delhi|ncr|gurgaon|gurugram|noida|mumbai|chennai|kolkata|india|remote|hybrid|on-?site|in-?office|wfh/i;
const BULLET_MAX = 160;

/** Any "N years / yrs / YOE" phrase, with or without an experience cue. */
export function mentionsYears(text: string): boolean {
  return new RegExp(YEARS_RE.source, "i").test(text);
}

/** First two bullets, preferring those that mention years or a location. */
export function pickBullets(description: string[], count = 2): string[] {
  const scored = (description ?? [])
    .map((text, index) => ({ text: text.trim(), index }))
    .filter((b) => b.text.length > 0)
    .map((b) => {
      let score = 0;
      if (mentionsYears(b.text)) score += 2;
      if (LOCATION_RE.test(b.text)) score += 1;
      return { ...b, score };
    });
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, count)
    .sort((a, b) => a.index - b.index)
    .map((b) => (b.text.length > BULLET_MAX ? `${b.text.slice(0, BULLET_MAX - 1).trimEnd()}…` : b.text));
}

// ─── Selection ───────────────────────────────────────────────────────────────

const POSTER_RANK: Record<PosterKind, number> = {
  "Hiring manager": 0,
  "Engineer (referral)": 1,
  Recruiter: 2,
};

export interface SelectOptions {
  jobs: NudgeJobInput[];
  profile: MatchProfile;
  /** Jobs already emailed to this user; never shown again. */
  excludeJobIds?: Iterable<number>;
  /** Jobs created after this instant are preferred ("new since your last nudge"). */
  sinceCreatedAt?: Date | null;
  limit?: number;
  now?: Date;
  env?: NodeJS.ProcessEnv;
}

export interface SelectResult {
  picks: RankedJob[];
  /** Jobs that passed every filter before the limit was applied. */
  poolSize: number;
  newCount: number;
}

export const DEFAULT_NUDGE_JOB_COUNT = 5;

/** Rank the board for one user. Returns an empty `picks` when nothing qualifies. */
export function selectJobsForUser(options: SelectOptions): SelectResult {
  const now = options.now ?? new Date();
  const limit = options.limit ?? DEFAULT_NUDGE_JOB_COUNT;
  const exclude = new Set(options.excludeJobIds ?? []);
  const since = options.sinceCreatedAt ?? null;

  const ranked: RankedJob[] = [];
  for (const job of options.jobs) {
    if (exclude.has(job.id)) continue;
    if (isJobExpired(job.postedAt, now)) continue;
    const gate = evaluateJobGates(
      {
        title: job.title,
        company: job.company,
        roleFamily: job.roleFamily,
        authorTitle: job.authorTitle,
        rawText: job.rawText ?? null,
      },
      options.env,
    );
    if (!gate.ok) continue;

    const seniority = effectiveSeniority(job);
    const matchPercent = computeTagOverlapScore(
      { roleFamily: job.roleFamily, seniority, remoteMode: job.remoteMode, stack: job.stack },
      options.profile,
    );
    ranked.push({
      id: job.id,
      title: gate.title,
      company: gate.company,
      author: job.author,
      authorTitle: job.authorTitle,
      source: job.source,
      sourceUrl: job.sourceUrl,
      roleFamily: job.roleFamily,
      seniority,
      storedSeniority: job.seniority,
      seniorOverride: seniority !== (job.seniority ?? "").toLowerCase(),
      levelLabel: levelLabel(seniority),
      remoteMode: job.remoteMode,
      remoteLabel: remoteLabel(job.remoteMode),
      stack: job.stack ?? [],
      posterKind: posterKind(job.authorTitle),
      posterLine: posterLine(job.authorTitle),
      bullets: pickBullets(job.description),
      postedAt: job.postedAt,
      createdAt: job.createdAt,
      matchPercent,
      isNew: since ? job.createdAt.getTime() > since.getTime() : true,
    });
  }

  ranked.sort((a, b) => {
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    if (a.matchPercent !== b.matchPercent) return b.matchPercent - a.matchPercent;
    const poster = POSTER_RANK[a.posterKind] - POSTER_RANK[b.posterKind];
    if (poster !== 0) return poster;
    const aKnown = a.company.toLowerCase() !== "unknown" ? 0 : 1;
    const bKnown = b.company.toLowerCase() !== "unknown" ? 0 : 1;
    if (aKnown !== bKnown) return aKnown - bKnown;
    return b.postedAt.getTime() - a.postedAt.getTime();
  });

  return {
    picks: ranked.slice(0, Math.max(0, limit)),
    poolSize: ranked.length,
    newCount: ranked.filter((j) => j.isNew).length,
  };
}
