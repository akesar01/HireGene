// Plain HTML + text templates for the match nudge. React Email was not used:
// the backend tsconfig compiles only src/**/*.ts and has no React dependency,
// and the template is one table. Everything is escaped before interpolation.
//
// Layout: one greeting line, one compact card per job (photo or initials,
// title, poster, meta, at most one momentum line, a "View post" button), one
// link to the feed, one footer line. Built for a phone screen and for
// Gmail/Outlook: tables, inline styles, bulletproof buttons, no web fonts.

import type { PosterKind } from "./nudge-select.js";

export interface RenderJob {
  id: number;
  title: string;
  company: string;
  author: string;
  authorAvatar?: string | null;
  posterKind: PosterKind;
  levelLabel: string;
  remoteLabel: string;
  postedAt: Date;
}

/** Engagement already recorded for a job. Only real counts; never estimated. */
export interface JobSignals {
  /** JobApplication rows ("Applied" on the site). */
  applied: number;
  /** Distinct email recipients who clicked through to the job. */
  viewers: number;
}

export interface RenderInput {
  recipientName?: string | null;
  jobs: RenderJob[];
  sendId: string;
  campaignKey: string;
  /** Frontend origin, e.g. https://skiptheboard.in */
  siteUrl: string;
  /** Null (test sends) renders an inert footer instead of a working link. */
  unsubscribeUrl: string | null;
  preferencesUrl: string;
  /** Variant overrides. Templates accept {count} {companies} {name}. */
  subjectTemplate?: string | null;
  intro?: string | null;
  /** Per-job counts for the momentum line. Missing jobs count as zero. */
  signals?: ReadonlyMap<number, JobSignals>;
  /** Send time: drives "posted N days ago", momentum, and avatar expiry. */
  now?: Date;
}

export interface RenderedEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

export const DEFAULT_SUBJECT_TEMPLATE = "{count} new jobs that match you";
export const PREHEADER = "Picked from posts by the people hiring";

export const UTM_SOURCE = "nudge";
export const TEST_SEND_UNSUBSCRIBE_NOTE = "unsubscribe disabled in test sends";

/** The site's accent (--accent in frontend/src/app/globals.css). */
export const ACCENT = "#ff5414";
const TEXT = "#1a1a1a";
const MUTED = "#6b7280";
const RULE = "#eeeeee";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const MOMENTUM_MIN_APPLIED = 3;
export const MOMENTUM_MIN_VIEWERS = 5;

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? vars[key] : whole));
}

function isKnown(value: string | null | undefined): value is string {
  const v = (value ?? "").trim();
  return v !== "" && v.toLowerCase() !== "unknown";
}

export function companiesLine(jobs: RenderJob[], max = 3): string {
  const seen: string[] = [];
  for (const job of jobs) {
    const name = job.company.trim();
    if (!isKnown(name)) continue;
    if (seen.some((s) => s.toLowerCase() === name.toLowerCase())) continue;
    seen.push(name);
    if (seen.length >= max) break;
  }
  return seen.join(", ");
}

export function goUrl(siteUrl: string, sendId: string, jobId: number): string {
  return `${siteUrl.replace(/\/$/, "")}/go/${encodeURIComponent(sendId)}/${jobId}`;
}

export function siteLink(siteUrl: string, path: string, campaignKey: string, content?: string): string {
  const url = new URL(path, siteUrl.replace(/\/$/, "") + "/");
  url.searchParams.set("utm_source", UTM_SOURCE);
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", campaignKey);
  if (content) url.searchParams.set("utm_content", content);
  return url.toString();
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function templateVars(input: RenderInput): Record<string, string> {
  const companies = companiesLine(input.jobs);
  return {
    count: String(input.jobs.length),
    companies: companies || "the people hiring",
    name: input.recipientName?.trim() || "there",
  };
}

export function renderSubject(input: RenderInput): string {
  const override = input.subjectTemplate?.trim();
  const n = input.jobs.length;
  const subject = override ? fillTemplate(override, templateVars(input)) : `${n} new ${plural(n, "job that matches", "jobs that match")} you`;
  return subject.replace(/\s+/g, " ").trim();
}

/** "Hi Ankit, 4 jobs matched your resume this week." or the variant intro. */
export function renderIntro(input: RenderInput): string {
  const vars = templateVars(input);
  const override = input.intro?.trim();
  if (override) return fillTemplate(override, vars).replace(/\s+/g, " ").trim();
  const n = input.jobs.length;
  const period = /(^|-)daily-/.test(input.campaignKey) ? "today" : "this week";
  return `Hi ${vars.name}, ${n} ${plural(n, "job", "jobs")} matched your resume ${period}.`;
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

/** "Srinivasarao Narayanasetty" -> "SN"; one word -> one letter. */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/**
 * The photo URL to show, or null for the initials badge. LinkedIn media URLs
 * carry their expiry as `e=<unix seconds>`; past that they 403, so an expired
 * one is treated like a missing one.
 */
export function usableAvatarUrl(url: string | null | undefined, now: Date): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (/(^|\.)licdn\.com$/i.test(parsed.hostname)) {
    const e = parsed.searchParams.get("e");
    if (e !== null) {
      const expiresAt = Number(e) * 1000;
      if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return null;
    }
  }
  return raw;
}

function avatarHtml(job: RenderJob, now: Date): string {
  const name = job.author.trim() || "Poster";
  const src = usableAvatarUrl(job.authorAvatar, now);
  if (src) {
    return `<img src="${escapeHtml(src)}" width="48" height="48" alt="${escapeHtml(name)}" style="display:block;width:48px;height:48px;border:0;border-radius:24px;object-fit:cover;">`;
  }
  return `<table role="presentation" width="48" height="48" cellpadding="0" cellspacing="0" border="0" style="width:48px;height:48px;"><tr><td width="48" height="48" align="center" valign="middle" bgcolor="${ACCENT}" aria-label="${escapeHtml(name)}" style="width:48px;height:48px;border-radius:24px;background:${ACCENT};color:#ffffff;font-family:${FONT};font-size:17px;font-weight:700;line-height:48px;text-align:center;">${escapeHtml(initials(name))}</td></tr></table>`;
}

// ─── Card lines ──────────────────────────────────────────────────────────────

/** Whole days since posting, never negative. */
export function daysSince(postedAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - postedAt.getTime()) / MS_PER_DAY));
}

export function postedAgo(postedAt: Date, now: Date): string {
  const days = daysSince(postedAt, now);
  if (days === 0) return "posted today";
  return `posted ${days} ${plural(days, "day", "days")} ago`;
}

export type MomentumKind = "applied" | "viewed" | "fresh" | "recent";

export interface Momentum {
  kind: MomentumKind;
  text: string;
}

/**
 * The single momentum line for a card, or null when nothing true applies.
 * First match wins: applications, then click-throughs, then posting age.
 * Counts are printed exactly as recorded.
 */
export function momentumFor(job: Pick<RenderJob, "postedAt">, signals: JobSignals | undefined, now: Date): Momentum | null {
  const applied = signals?.applied ?? 0;
  const viewers = signals?.viewers ?? 0;
  if (applied >= MOMENTUM_MIN_APPLIED) return { kind: "applied", text: `${applied} people applied via SkipTheBoard` };
  if (viewers >= MOMENTUM_MIN_VIEWERS) return { kind: "viewed", text: `${viewers} people viewed this` };
  const ageMs = now.getTime() - job.postedAt.getTime();
  if (ageMs < MS_PER_DAY) return { kind: "fresh", text: "Posted today, early applicants get noticed" };
  const days = daysSince(job.postedAt, now);
  if (days >= 2 && days <= 6) return { kind: "recent", text: `Posted ${days} days ago, apply before it fills up` };
  return null;
}

export interface CardLines {
  title: string;
  poster: string;
  meta: string;
  momentum: string | null;
}

/** The text of one card. Unknown parts are dropped, never printed as placeholders. */
export function cardLines(job: RenderJob, signals: JobSignals | undefined, now: Date): CardLines {
  const title = [job.title.trim(), isKnown(job.company) ? job.company.trim() : ""].filter(Boolean).join(" · ");
  const firstName = job.author.trim().split(/\s+/)[0] ?? "";
  const poster = [firstName, job.posterKind].filter(isKnown).join(" · ");
  const momentum = momentumFor(job, signals, now);
  // When the momentum line already states the posting age, the meta line skips it.
  const statesAge = momentum?.kind === "fresh" || momentum?.kind === "recent";
  const meta = [job.levelLabel, job.remoteLabel, statesAge ? "" : postedAgo(job.postedAt, now)].filter(isKnown).join(" · ");
  return { title, poster, meta, momentum: momentum?.text ?? null };
}

/** Table-based button: the cell carries the color so Outlook paints it too. */
function buttonHtml(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${ACCENT}" style="border-radius:6px;background:${ACCENT};"><a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:9px 18px;font-family:${FONT};font-size:14px;font-weight:600;line-height:18px;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a></td></tr></table>`;
}

// ─── Email ───────────────────────────────────────────────────────────────────

export function renderNudgeEmail(input: RenderInput): RenderedEmail {
  const now = input.now ?? new Date();
  const subject = renderSubject(input);
  const intro = renderIntro(input);
  const preheader = PREHEADER;
  const feedUrl = siteLink(input.siteUrl, "/", input.campaignKey, "feed");
  const reason = "You get this because you uploaded your resume to SkipTheBoard.";

  const cards = input.jobs.map((job) => ({
    job,
    lines: cardLines(job, input.signals?.get(job.id), now),
    href: goUrl(input.siteUrl, input.sendId, job.id),
  }));

  const muted = `font-size:13px;line-height:19px;color:${MUTED};`;
  const jobsHtml = cards
    .map(
      ({ job, lines, href }) => `
<tr><td style="padding:18px 0;border-top:1px solid ${RULE};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="48" valign="top" style="width:48px;padding:2px 14px 0 0;">${avatarHtml(job, now)}</td>
<td valign="top" style="font-family:${FONT};">
<div style="font-size:15px;line-height:21px;font-weight:700;color:${TEXT};">${escapeHtml(lines.title)}</div>
${lines.poster ? `<div style="${muted}padding-top:2px;">${escapeHtml(lines.poster)}</div>` : ""}
${lines.meta ? `<div style="${muted}">${escapeHtml(lines.meta)}</div>` : ""}
${lines.momentum ? `<div style="font-size:13px;line-height:19px;font-weight:600;color:${ACCENT};padding-top:4px;">${escapeHtml(lines.momentum)}</div>` : ""}
<div style="padding-top:10px;">${buttonHtml(href, "View post")}</div>
</td></tr></table>
</td></tr>`,
    )
    .join("");

  const unsubscribeHtml = input.unsubscribeUrl
    ? `<a href="${escapeHtml(input.unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>`
    : `<span>${TEST_SEND_UNSUBSCRIBE_NOTE}</span>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:${FONT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 0 18px 0;font-family:${FONT};font-size:16px;line-height:24px;color:${TEXT};">${escapeHtml(intro)}</td></tr>
${jobsHtml}
<tr><td style="padding:18px 0;border-top:1px solid ${RULE};font-family:${FONT};font-size:14px;line-height:20px;">
<a href="${escapeHtml(feedUrl)}" style="color:${ACCENT};font-weight:600;text-decoration:none;">See all jobs on SkipTheBoard</a>
</td></tr>
<tr><td style="padding:8px 0 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">
${escapeHtml(reason)} ${unsubscribeHtml} &middot; <a href="${escapeHtml(input.preferencesUrl)}" style="color:${MUTED};text-decoration:underline;">Email settings</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const textJobs = cards
    .map(({ lines, href }) => [lines.title, lines.poster, lines.meta, lines.momentum, `View post: ${href}`].filter(Boolean).join("\n"))
    .join("\n\n");

  const text = [
    intro,
    "",
    textJobs,
    "",
    `See all jobs on SkipTheBoard: ${feedUrl}`,
    "",
    reason,
    input.unsubscribeUrl ? `Unsubscribe: ${input.unsubscribeUrl}` : TEST_SEND_UNSUBSCRIBE_NOTE,
    `Email settings: ${input.preferencesUrl}`,
  ].join("\n");

  return { subject, preheader, html, text };
}
