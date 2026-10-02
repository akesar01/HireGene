// Plain HTML + text templates for the match nudge. React Email was not used:
// the backend tsconfig compiles only src/**/*.ts and has no React dependency,
// and the template is one table. Everything is escaped before interpolation.

import type { PosterKind } from "./nudge-select.js";

export interface RenderJob {
  id: number;
  title: string;
  company: string;
  author: string;
  posterKind: PosterKind;
  posterLine: string;
  levelLabel: string;
  remoteLabel: string;
  stack: string[];
  postedAt: Date;
  bullets: string[];
  matchPercent: number;
}

export interface RenderInput {
  recipientName?: string | null;
  jobs: RenderJob[];
  sendId: string;
  campaignKey: string;
  /** Frontend origin, e.g. https://skiptheboard.in */
  siteUrl: string;
  unsubscribeUrl: string;
  preferencesUrl: string;
  /** Variant overrides. Templates accept {count} {companies} {name}. */
  subjectTemplate?: string | null;
  intro?: string | null;
  contactEmail?: string;
}

export interface RenderedEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

export const DEFAULT_SUBJECT_TEMPLATE = "{count} jobs that match your resume: {companies}";
export const DEFAULT_INTRO_TEMPLATE =
  "These are the {count} posts on SkipTheBoard that best match your resume right now. Each one links to the original hiring post, so you can message the person who wrote it.";

export const UTM_SOURCE = "nudge";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "23 Sep" in UTC. Absolute dates stay true in an inbox; relative ones go stale. */
export function formatPostedDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? vars[key] : whole));
}

export function companiesLine(jobs: RenderJob[], max = 3): string {
  const seen: string[] = [];
  for (const job of jobs) {
    const name = job.company.trim();
    if (!name || name.toLowerCase() === "unknown") continue;
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

function templateVars(input: RenderInput): Record<string, string> {
  const companies = companiesLine(input.jobs);
  return {
    count: String(input.jobs.length),
    companies: companies || "the people hiring",
    name: input.recipientName?.trim() || "there",
  };
}

export function renderSubject(input: RenderInput): string {
  const template = input.subjectTemplate?.trim() || DEFAULT_SUBJECT_TEMPLATE;
  return fillTemplate(template, templateVars(input)).replace(/\s+/g, " ").trim();
}

const STACK_LABELS: Record<string, string> = {
  nodejs: "Node.js",
  nextjs: "Next.js",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
  sql: "SQL",
  ai: "AI",
  aws: "AWS",
  langchain: "LangChain",
  rag: "RAG",
  react: "React",
  llm: "LLM",
  go: "Go",
  rust: "Rust",
  docker: "Docker",
};

export function stackLabel(stack: string[], max = 3): string {
  return stack
    .slice(0, max)
    .map((s) => STACK_LABELS[s.toLowerCase()] ?? s)
    .join(", ");
}

export function renderNudgeEmail(input: RenderInput): RenderedEmail {
  const vars = templateVars(input);
  const subject = renderSubject(input);
  const intro = fillTemplate(input.intro?.trim() || DEFAULT_INTRO_TEMPLATE, vars);
  const preheader = `Your top ${input.jobs.length} matches, picked from posts by the people hiring.`;
  const contact = input.contactEmail ?? "hello@skiptheboard.in";
  const feedUrl = siteLink(input.siteUrl, "/", input.campaignKey, "feed");
  const profileUrl = siteLink(input.siteUrl, "/profile", input.campaignKey, "profile");
  const greeting = vars.name === "there" ? "Hi there," : `Hi ${vars.name},`;

  const jobsHtml = input.jobs
    .map((job, index) => {
      const meta = [job.levelLabel, job.remoteLabel, stackLabel(job.stack), `Posted ${formatPostedDate(job.postedAt)}`]
        .filter(Boolean)
        .map(escapeHtml)
        .join(" &middot; ");
      const bullets = job.bullets.map((b) => `<li style="margin:0 0 4px 0;">${escapeHtml(b)}</li>`).join("");
      const open = goUrl(input.siteUrl, input.sendId, job.id);
      const dm = siteLink(input.siteUrl, "/", input.campaignKey, `dm-${job.id}`);
      return `
<tr><td style="padding:18px 0;border-top:1px solid #e5e7eb;">
  <div style="font-size:16px;font-weight:700;color:#1a1a1a;line-height:1.4;">
    ${index + 1}. ${escapeHtml(job.title)} &middot; ${escapeHtml(job.company)}
    <span style="display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;background:#fff0eb;color:#e64a0e;font-size:12px;font-weight:600;vertical-align:middle;">Match ${job.matchPercent}%</span>
  </div>
  <div style="font-size:13px;color:#4b5563;margin-top:4px;">
    Posted by <strong style="color:#1a1a1a;">${escapeHtml(job.author)}</strong>${job.posterLine ? ` &middot; ${escapeHtml(job.posterLine)}` : ""} &middot; <em>${escapeHtml(job.posterKind)}</em>
  </div>
  <div style="font-size:13px;color:#6b7280;margin-top:2px;">${meta}</div>
  ${bullets ? `<ul style="margin:8px 0 0 0;padding-left:18px;font-size:13px;color:#374151;">${bullets}</ul>` : ""}
  <div style="font-size:13px;margin-top:10px;">
    <a href="${escapeHtml(open)}" style="color:#e64a0e;font-weight:600;text-decoration:none;">Open the original post &rarr;</a>
    &nbsp;&middot;&nbsp;
    <a href="${escapeHtml(dm)}" style="color:#4b5563;text-decoration:underline;">Draft a DM from your resume &rarr;</a>
  </div>
</td></tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f8;font-family:Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f8;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
<tr><td style="font-size:18px;font-weight:700;color:#1a1a1a;padding-bottom:12px;">SkipTheBoard</td></tr>
<tr><td style="font-size:14px;color:#374151;line-height:1.6;padding-bottom:8px;">${escapeHtml(greeting)}</td></tr>
<tr><td style="font-size:14px;color:#374151;line-height:1.6;padding-bottom:12px;">${escapeHtml(intro)}</td></tr>
${jobsHtml}
<tr><td style="padding:18px 0 0 0;border-top:1px solid #e5e7eb;font-size:14px;color:#374151;line-height:1.6;">
  <a href="${escapeHtml(feedUrl)}" style="color:#e64a0e;font-weight:600;text-decoration:none;">See the full ranked feed &rarr;</a><br>
  Scores come from your resume on your <a href="${escapeHtml(profileUrl)}" style="color:#4b5563;">profile</a>. Update it and next time's picks change.
</td></tr>
<tr><td style="padding-top:20px;font-size:12px;color:#9ca3af;line-height:1.6;">
  You get this because you signed in to SkipTheBoard and uploaded a resume.
  <a href="${escapeHtml(input.preferencesUrl)}" style="color:#6b7280;">Change frequency</a> &middot;
  <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#6b7280;">Unsubscribe in one click</a><br>
  SkipTheBoard &middot; ${escapeHtml(contact)} &middot; We never sell or share your email.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const textJobs = input.jobs
    .map((job, index) => {
      const meta = [job.levelLabel, job.remoteLabel, stackLabel(job.stack), `Posted ${formatPostedDate(job.postedAt)}`]
        .filter(Boolean)
        .join(" · ");
      const lines = [
        `${index + 1}. ${job.title} · ${job.company} (Match ${job.matchPercent}%)`,
        `   Posted by ${job.author}${job.posterLine ? ` · ${job.posterLine}` : ""} · ${job.posterKind}`,
        `   ${meta}`,
        ...job.bullets.map((b) => `   • ${b}`),
        `   Open the original post: ${goUrl(input.siteUrl, input.sendId, job.id)}`,
      ];
      return lines.join("\n");
    })
    .join("\n\n");

  const text = [
    greeting,
    "",
    intro,
    "",
    textJobs,
    "",
    `See the full ranked feed: ${feedUrl}`,
    `Update your resume or preferences: ${profileUrl}`,
    "",
    "You get this because you signed in to SkipTheBoard and uploaded a resume.",
    `Change frequency: ${input.preferencesUrl}`,
    `Unsubscribe in one click: ${input.unsubscribeUrl}`,
    `SkipTheBoard · ${contact} · We never sell or share your email.`,
  ].join("\n");

  return { subject, preheader, html, text };
}
