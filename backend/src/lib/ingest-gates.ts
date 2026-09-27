// Deterministic quality gates applied before a scraped post becomes a Job.
// Pure functions only: no Prisma, no LLM. Shared by ingest (apify.ts) and the
// scripts/reclassify-jobs.ts cleanup so both agree on what "junk" means.

import { extractExplicitTitle } from "./classifier.js";
import {
  cleanCompanyName,
  extractCompanyFromHeadline,
  isSuspiciousCompany,
  LOCATION_WORDS,
} from "./extract-company.js";
import { MS_PER_DAY } from "./job-expiry.js";
import { VALID_ROLE_FAMILIES } from "./llm-classifier.js";

export type IngestSkipReason =
  | "no_url"
  | "not_job"
  | "expired"
  | "off_target"
  | "unparseable"
  | "duplicate";

export const SKIP_REASONS: IngestSkipReason[] = [
  "no_url",
  "not_job",
  "expired",
  "off_target",
  "unparseable",
  "duplicate",
];

const ROLE_FAMILIES = new Set<string>(VALID_ROLE_FAMILIES);

export const DEFAULT_ROLE_FAMILIES = ["engineering", "ai_ml"] as const;

const warnedRoleFamilyValues = new Set<string>();

/** Role families allowed into the feed; `INGEST_ROLE_FAMILIES` overrides. */
export function allowedRoleFamilies(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const raw = env.INGEST_ROLE_FAMILIES ?? "";
  const entries = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const configured = entries.filter((value) => ROLE_FAMILIES.has(value));
  const dropped = entries.filter((value) => !ROLE_FAMILIES.has(value));
  const allowed = new Set(configured.length > 0 ? configured : DEFAULT_ROLE_FAMILIES);
  if (dropped.length > 0 && !warnedRoleFamilyValues.has(raw)) {
    warnedRoleFamilyValues.add(raw);
    console.warn(
      `[ingest] INGEST_ROLE_FAMILIES ignored unknown ${dropped.join(",")}; using ${[...allowed].join(",")}`,
    );
  }
  return allowed;
}

/**
 * Titles that are engineering-adjacent sales, support, or recruiting roles.
 * Rejected even when the classifier files them under engineering.
 */
const OFF_TARGET_TITLE_PATTERNS = [
  /\bsales\s+engineer/i,
  /\bsolutions?\s+(?:engineer|consultant)/i,
  /\bpre-?\s?sales\b/i,
  /\bcustomer\s+success\b/i,
  /\bsupport\s+engineer/i,
  /\brecruit(?:er|ing|ment)\b/i,
  /\btalent\b/i,
];

export function isOffTargetTitle(title: string): boolean {
  return OFF_TARGET_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

const LOCATION_LINE_WORDS = new Set([
  ...LOCATION_WORDS,
  "hybrid",
  "onsite",
  "on-site",
  "in-office",
  "wfh",
  "work from home",
  "location",
]);

function isLocationLine(title: string): boolean {
  const segments = title
    .toLowerCase()
    .replace(/^location\s*:/, "")
    .split(/[|,/;:()]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  return segments.length > 0 && segments.every((segment) => LOCATION_LINE_WORDS.has(segment));
}

/** A title we are willing to show on a job card. */
export function isWellFormedTitle(title: string): boolean {
  const value = title.trim();
  if (!value) return false;
  const letters = (value.match(/\p{L}/gu) ?? []).length;
  if (letters < 3) return false;
  if (/^[|\-–—•:;,/]/.test(value)) return false;
  const nonSpace = value.replace(/\s+/g, "").length;
  if (letters / nonSpace < 0.6) return false;
  if ((value.match(/\|/g) ?? []).length >= 2) return false;
  if (isLocationLine(value)) return false;
  return true;
}

/** Lowercase, punctuation stripped, whitespace collapsed. */
export function normalizeForDedupe(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const NEAR_DUPLICATE_WINDOW_DAYS = 14;

export interface DedupeKey {
  title: string;
  company: string;
  postedAt: Date;
}

/** Same recruiter is assumed; same normalized title + company within 14 days. */
export function isNearDuplicate(a: DedupeKey, b: DedupeKey): boolean {
  if (normalizeForDedupe(a.title) !== normalizeForDedupe(b.title)) return false;
  if (normalizeForDedupe(a.company) !== normalizeForDedupe(b.company)) return false;
  const gap = Math.abs(a.postedAt.getTime() - b.postedAt.getTime());
  return gap <= NEAR_DUPLICATE_WINDOW_DAYS * MS_PER_DAY;
}

export function findNearDuplicate<T extends DedupeKey>(candidate: DedupeKey, existing: T[]): T | undefined {
  return existing.find((job) => isNearDuplicate(candidate, job));
}

export interface GateInput {
  title: string;
  company: string;
  roleFamily: string;
  authorTitle?: string | null;
  rawText?: string | null;
}

export type GateResult =
  | { ok: true; title: string; company: string }
  | { ok: false; reason: "off_target" | "unparseable"; detail: string };

/**
 * Resolve a company we are willing to store: the given value if it is sane,
 * else the recruiter headline's company, else "Unknown".
 */
export function resolveCompany(company: string, headline?: string | null): string {
  const cleaned = cleanCompanyName(company);
  if (cleaned && cleaned.toLowerCase() !== "unknown" && !isSuspiciousCompany(cleaned)) return cleaned;
  const fromHeadline = extractCompanyFromHeadline(headline ?? "");
  if (fromHeadline && !isSuspiciousCompany(fromHeadline)) return fromHeadline;
  return "Unknown";
}

/**
 * Apply the engineering-only and well-formedness gates. Returns the title and
 * company to store on success, or the skip reason on failure.
 */
export function evaluateJobGates(input: GateInput, env: NodeJS.ProcessEnv = process.env): GateResult {
  const allowed = allowedRoleFamilies(env);
  const roleFamily = (input.roleFamily ?? "").toLowerCase();
  if (!allowed.has(roleFamily)) {
    return {
      ok: false,
      reason: "off_target",
      detail: `roleFamily ${roleFamily || "?"} not in ${[...allowed].join(",")}`,
    };
  }

  let title = (input.title ?? "").trim();
  if (!isWellFormedTitle(title)) {
    const explicit = extractExplicitTitle(input.rawText ?? "").trim();
    if (isWellFormedTitle(explicit)) title = explicit;
  }
  if (!title) {
    return { ok: false, reason: "unparseable", detail: "empty title" };
  }
  if (isOffTargetTitle(title)) {
    return { ok: false, reason: "off_target", detail: `title "${title}" is sales/support/recruiting` };
  }
  if (!isWellFormedTitle(title)) {
    return { ok: false, reason: "unparseable", detail: `malformed title "${title}"` };
  }

  return { ok: true, title, company: resolveCompany(input.company ?? "", input.authorTitle) };
}
