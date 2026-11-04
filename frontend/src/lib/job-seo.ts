// Public job pages: URLs, page text, and JobPosting structured data for Google
// for Jobs (https://developers.google.com/search/docs/appearance/structured-data/job-posting).
// Everything here is built from fields we already hold. A fact we do not have
// is left out, never guessed, and a job without a company or a location gets
// no structured data at all.

import { JOB_EXPIRY_DAYS, SITE_URL } from "./config";
import type { Job, JobDetail } from "./data";

const DAY_MS = 86_400_000;
const SLUG_BASE_MAX = 80;

// ─── URLs ────────────────────────────────────────────────────────────────────

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Ingest sometimes stores a role, a team or a college in the company slot.
// Those are not employers, so they must never reach hiringOrganization.
const ROLE_WORD_RE =
  /^(?:(?:co[\s-]?)?founder|ceo|cto|coo|cfo|cxo|vp|director|head|manager|hiring manager|recruiter|hr|talent acquisition)$/i;
const NOT_AN_EMPLOYER_RE = /\b(?:across|team|university|college)\b/i;

export function isKnownCompany(company: string | null | undefined): company is string {
  const name = (company ?? "").trim();
  if (name === "" || name.toLowerCase() === "unknown") return false;
  if (name.replace(/[^\p{L}\p{N}]/gu, "").length <= 2) return false;
  if (NOT_AN_EMPLOYER_RE.test(name)) return false;
  const parts = name.split(/\s*(?:&|,|\/|\band\b)\s*/i).filter(Boolean);
  return !parts.every((part) => ROLE_WORD_RE.test(part));
}

/** title-company-city-id, e.g. senior-backend-engineer-razorpay-bengaluru-42. */
export function jobSlug(job: Pick<Job, "id" | "title" | "company" | "locations">): string {
  const parts = [job.title, isKnownCompany(job.company) ? job.company : "", job.locations?.[0]?.city ?? ""];
  let base = parts.map(slugify).filter(Boolean).join("-");
  if (base.length > SLUG_BASE_MAX) base = base.slice(0, SLUG_BASE_MAX).replace(/-[^-]*$/, "");
  return base ? `${base}-${job.id}` : String(job.id);
}

export function jobPath(job: Pick<Job, "id" | "title" | "company" | "locations">): string {
  return `/jobs/${jobSlug(job)}`;
}

export function jobUrl(job: Pick<Job, "id" | "title" | "company" | "locations">): string {
  return `${SITE_URL}${jobPath(job)}`;
}

/** Job ids are Postgres Int4. */
const MAX_JOB_ID = 2_147_483_647;

/** The job id at the end of a slug; the words before it are only for people. */
export function parseJobSlug(slug: string): number | null {
  const match = /(?:^|-)([1-9]\d{0,9})$/.exec(slug);
  const id = match ? Number(match[1]) : null;
  return id !== null && id <= MAX_JOB_ID ? id : null;
}

// ─── Dates ───────────────────────────────────────────────────────────────────

/** postedAt + JOB_EXPIRY_DAYS, the moment the job leaves the feed. */
export function jobValidThrough(postedAt: string): string {
  return new Date(new Date(postedAt).getTime() + JOB_EXPIRY_DAYS * DAY_MS).toISOString();
}

export function isJobPageExpired(job: Pick<JobDetail, "postedAt" | "expired">, now = new Date()): boolean {
  return job.expired || now.getTime() >= new Date(jobValidThrough(job.postedAt)).getTime();
}

export function formatPostedDate(postedAt: string): string {
  return new Date(postedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

// ─── Page text ───────────────────────────────────────────────────────────────

const STACK_LABELS: Record<string, string> = {
  python: "Python",
  java: "Java",
  sql: "SQL",
  ai: "AI",
  aws: "AWS",
  langchain: "LangChain",
  rag: "RAG",
  react: "React",
  llm: "LLM",
  nextjs: "Next.js",
  "next.js": "Next.js",
  typescript: "TypeScript",
  nodejs: "Node.js",
  "node.js": "Node.js",
  go: "Go",
  rust: "Rust",
  docker: "Docker",
};

export function skillLabels(stack: string[]): string[] {
  return stack.map((s) => STACK_LABELS[s] ?? s);
}

const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACTOR: "Contract",
  INTERN: "Internship",
};

export function employmentLabel(job: Pick<JobDetail, "employmentTypes">): string {
  return job.employmentTypes.map((t) => EMPLOYMENT_LABELS[t] ?? t).join(", ");
}

export function isRemote(job: Pick<Job, "remoteMode">): boolean {
  return job.remoteMode === "remote";
}

/** "Bengaluru, Pune", "Remote (India)", or "" when the post names no place. */
export function locationLabel(job: Pick<JobDetail, "remoteMode" | "locations" | "country">): string {
  if (isRemote(job)) return job.country === "IN" ? "Remote (India)" : "Remote";
  return job.locations.map((l) => l.city).join(", ");
}

export function posterFirstName(author: string): string {
  return author.trim().split(/\s+/)[0] ?? "";
}

/** "Harish · Hiring manager", as on the email cards. */
export function posterLabel(job: Pick<JobDetail, "author" | "posterKind">): string {
  return [posterFirstName(job.author), job.posterKind].filter(Boolean).join(" · ");
}

export function sourceLabel(source: Job["source"]): string {
  return source === "x" ? "X" : "LinkedIn";
}

/** Our own short description of the role, built from its fields. */
export function jobSummary(job: JobDetail): string {
  const who = isKnownCompany(job.company) ? `${job.company.trim()} is hiring` : "Hiring";
  let place = "";
  if (isRemote(job)) place = job.country === "IN" ? " to work remotely from India" : " to work remotely";
  else if (job.locations.length) place = ` in ${job.locations.map((l) => l.city).join(", ")}`;
  const details = [job.levelLabel, isRemote(job) ? "" : job.remoteLabel, employmentLabel(job)].filter(Boolean);
  const role = `${who} for the role of ${job.title.trim()}${place}.`;
  return details.length ? `${role} ${details.join(", ")}.` : role;
}

/** <title> text; the layout template appends "| SkipTheBoard". */
export function jobPageTitle(job: JobDetail): string {
  const company = isKnownCompany(job.company) ? ` at ${job.company.trim()}` : "";
  const where = locationLabel(job);
  return `${job.title.trim()}${company}${where ? `, ${where}` : ""}`;
}

const META_DESCRIPTION_MAX = 160;

/** Summary, then skills and poster while they fit in 160 characters. */
export function jobMetaDescription(job: JobDetail): string {
  const skills = skillLabels(job.stack);
  const [first, ...rest] = [
    jobSummary(job),
    skills.length ? `Skills: ${skills.join(", ")}.` : "",
    `Posted by the ${job.posterKind.toLowerCase()} on ${sourceLabel(job.source)}.`,
  ].filter(Boolean);
  if (first.length > META_DESCRIPTION_MAX) {
    return `${first.slice(0, META_DESCRIPTION_MAX - 1).replace(/\s+\S*$/, "")}…`;
  }
  let text = first;
  for (const part of rest) {
    if (text.length + 1 + part.length <= META_DESCRIPTION_MAX) text = `${text} ${part}`;
  }
  return text;
}

// ─── Structured data ─────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** JobPosting.description: our summary, the key points we extracted, and who posted it. */
export function jobDescriptionHtml(job: JobDetail): string {
  const skills = skillLabels(job.stack);
  const bullets = job.description.map((d) => d.trim()).filter(Boolean);
  return [
    `<p>${escapeHtml(jobSummary(job))}</p>`,
    skills.length ? `<p>Skills: ${escapeHtml(skills.join(", "))}</p>` : "",
    bullets.length ? `<ul>${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>` : "",
    `<p>Posted on ${sourceLabel(job.source)} by ${escapeHtml(posterLabel(job))}. Apply through the original post.</p>`,
  ].join("");
}

const COUNTRY_NAMES: Record<string, string> = { IN: "India" };

/**
 * Google JobPosting JSON-LD, or null when the job must not carry any:
 * expired, no known company, or no location we can state.
 */
export function buildJobPostingJsonLd(job: JobDetail, now = new Date()): Record<string, unknown> | null {
  if (isJobPageExpired(job, now)) return null;
  if (!isKnownCompany(job.company) || !job.title.trim()) return null;

  let location: Record<string, unknown>;
  if (isRemote(job)) {
    if (!job.country) return null;
    location = {
      jobLocationType: "TELECOMMUTE",
      applicantLocationRequirements: { "@type": "Country", name: COUNTRY_NAMES[job.country] ?? job.country },
    };
  } else {
    if (job.locations.length === 0) return null;
    const places = job.locations.map((l) => ({
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: l.city,
        addressRegion: l.region,
        addressCountry: l.country,
      },
    }));
    location = { jobLocation: places.length === 1 ? places[0] : places };
  }

  const types = job.employmentTypes;
  return {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title.trim(),
    description: jobDescriptionHtml(job),
    identifier: { "@type": "PropertyValue", name: "SkipTheBoard", value: String(job.id) },
    datePosted: new Date(job.postedAt).toISOString(),
    validThrough: jobValidThrough(job.postedAt),
    ...(types.length ? { employmentType: types.length === 1 ? types[0] : types } : {}),
    hiringOrganization: { "@type": "Organization", name: job.company.trim() },
    ...location,
    directApply: false,
    url: jobUrl(job),
  };
}

/** JSON for a <script type="application/ld+json">, safe against "</script>". */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
