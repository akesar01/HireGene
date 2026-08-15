// Draft a LinkedIn/X DM from a parsed resume + job post.
// Groq writes two specific options. A deterministic template is the fallback.

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export const CONNECT_NOTE_MAX = 300;
export const MESSAGE_MAX = 1200;

export interface OutreachJob {
  title: string;
  company: string;
  author: string;
  authorTitle: string;
  source: "linkedin" | "x";
  sourceUrl: string;
  authorProfileUrl?: string | null;
  roleFamily: string;
  seniority: string;
  remoteMode: string;
  stack: string[];
  description: string[];
  rawText?: string;
}

export interface OutreachProfile {
  contact: {
    name: string;
    location?: string;
    github?: string;
    portfolio?: string;
  };
  filterSummary: {
    currentTitle: string;
    roleFamily: string;
    seniority: string;
    stack: string[];
  };
  skills: {
    languages: string[];
    frameworks: string[];
    tools: string[];
  };
  experience: {
    title: string;
    company: string;
    startDate?: string;
    endDate?: string;
    bullets: string[];
  }[];
  education: { degree: string; institution: string; graduationYear?: string }[];
  certifications?: string[];
}

export interface OutreachOption {
  id: string;
  label: string;
  why: string;
  message: string;
}

export interface OutreachDraft {
  message: string;
  connectNote: string;
  options: OutreachOption[];
}

const SYSTEM_PROMPT = `You write FIRST-CONTACT notes. The reader does not know this person yet. Do not sell. Do not pitch. Introduce, name the opening, offer a resume link.

This is a connection request or a first DM, not a cover letter.

BAD (never write this):
"Hi Uzma - 2M Kafka events/day on Java/Spring, same stack as your Walmart SSE post. Ok to connect?"
"Hi Vamsi, 2M Kafka events/day on AWS - the throughput you asked for."
A wall of metric bullets. "Want the two projects behind those numbers?"

GOOD connection note (under ${CONNECT_NOTE_MAX} chars):
"Hi Uzma, I work on Java, Spring, and Kafka. You posted the Senior Software Engineer role at Walmart. Happy to connect - resume: https://skiptheboard.in/r/abc123"

GOOD first DM:
"Hi Uzma, you posted the Senior Software Engineer role at Walmart. I work on Java, Spring, and Kafka.

If it is useful, here is my resume:
https://skiptheboard.in/r/abc123

Happy to share more if this is relevant."

Return ONLY valid JSON:
{
  "options": [
    {"id":"warm","label":"Warm intro","why":"string","message":"string"},
    {"id":"role","label":"Role mention","why":"string","message":"string"}
  ],
  "connectNote":"string"
}

Two DIFFERENT first DMs. Short. 50-90 words. No bullet list of achievements.
1) warm: who you are + the role/company + resume link + a soft close.
2) role: name one thing from THEIR post in plain English, then who you are, then resume link.

If resumeUrl is in the ammo pack, BOTH DMs and the connect note MUST include it on its own line or after a colon.
If resumeUrl is empty, do not invent a link.

connectNote:
- HARD MAX ${CONNECT_NOTE_MAX} characters including the URL.
- 2 short sentences + resume link + "Happy to connect."
- Full job title and company. Never "SSE post", "seat", or "same stack as your post".
- One "I work on ..." or "I have been working on ..." - not a metric dump.

Hard rules:
- Invent nothing. Only use skills/titles/companies in the ammo pack.
- Ban: saw your post, I came across, reaching out, passionate, excited, great fit, valuable contribution, leverage, synergy, I hope this finds you well, discuss my fit, hop on a call, Ok to connect, SSE post.
- No emoji, no hashtags, no em dash, no metric-first telegram lines.`;

export function firstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const skip = new Set(["mr", "mrs", "ms", "dr", "prof"]);
  const first = parts.find((p) => !skip.has(p.toLowerCase().replace(/\./g, "")));
  return first || "there";
}

export function inferProfileUrl(sourceUrl: string): string | null {
  try {
    const u = new URL(sourceUrl);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();

    if (host.endsWith("linkedin.com")) {
      const inMatch = u.pathname.match(/^\/in\/([^/?#]+)/);
      if (inMatch) return `https://www.linkedin.com/in/${inMatch[1]}`;

      const posts = u.pathname.match(/^\/posts\/([^/?#]+)/);
      if (posts) {
        const slug = posts[1].split("_")[0];
        if (slug && slug !== "activity") {
          return `https://www.linkedin.com/in/${slug}`;
        }
      }
      return null;
    }

    if (host === "x.com" || host === "twitter.com") {
      const status = u.pathname.match(/^\/([^/?#]+)\/status\//);
      if (status && !isReservedXHandle(status[1])) return `https://x.com/${status[1]}`;
      const profile = u.pathname.match(/^\/([^/?#]+)\/?$/);
      if (profile && !isReservedXHandle(profile[1])) return `https://x.com/${profile[1]}`;
    }
  } catch {
    return null;
  }
  return null;
}

function isReservedXHandle(handle: string): boolean {
  return ["i", "home", "intent", "share", "search", "explore"].includes(handle.toLowerCase());
}

export function resolveOpenUrl(job: OutreachJob): string {
  const explicit = job.authorProfileUrl?.trim();
  if (explicit) return explicit;
  return inferProfileUrl(job.sourceUrl) ?? job.sourceUrl;
}

export function profileHasOutreachContext(profile: OutreachProfile): boolean {
  const name = profile.contact?.name?.trim();
  const title = profile.filterSummary?.currentTitle?.trim();
  const exp = profile.experience?.length ?? 0;
  const skills = [
    ...(profile.skills?.languages ?? []),
    ...(profile.skills?.frameworks ?? []),
  ].length;
  return Boolean(name || title || exp > 0 || skills > 0);
}

export function pickProofPoints(profile: OutreachProfile, job: OutreachJob, limit = 2): string[] {
  const needles = new Set(
    job.stack
      .map((s) => s.toLowerCase().replace(/[._]/g, " "))
      .concat(job.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3)),
  );

  const scored: { text: string; score: number }[] = [];
  for (const exp of profile.experience ?? []) {
    for (const bullet of exp.bullets ?? []) {
      const lower = bullet.toLowerCase();
      let score = 0;
      for (const n of needles) {
        if (n && lower.includes(n)) score += 1;
      }
      if (/\d/.test(bullet)) score += 1;
      scored.push({ text: clipLine(bullet, 180), score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const matched = scored.filter((s) => s.score > 0).slice(0, limit).map((s) => s.text);
  if (matched.length > 0) return matched;
  return scored.slice(0, limit).map((s) => s.text).filter(Boolean);
}

export function extractPostHooks(job: OutreachJob): string[] {
  const raw = `${job.title}. ${job.description.join(". ")}. ${job.rawText ?? ""}`;
  const hooks: string[] = [];
  const looking = raw.match(/(?:looking for|need(?:s|ed)?|must have|we want|seeking)\s+([^.\n]{12,90})/i);
  if (looking) hooks.push(looking[1].trim());
  for (const tech of job.stack) {
    if (new RegExp(`\\b${tech.replace(/[._]/g, ".?")}\\b`, "i").test(raw)) {
      hooks.push(tech);
    }
  }
  const loc = raw.match(/\b(hyderabad|bangalore|bengaluru|pune|mumbai|delhi|noida|gurgaon|remote|hybrid)\b/i);
  if (loc) hooks.push(loc[1]);
  if (job.title) hooks.push(job.title);
  if (job.company) hooks.push(job.company);
  return [...new Set(hooks.map((h) => h.replace(/\s+/g, " ").trim()).filter(Boolean))].slice(0, 8);
}

export function rankedProofs(profile: OutreachProfile, job: OutreachJob, limit = 6): string[] {
  return pickProofPoints(profile, job, limit);
}

export function looksGeneric(text: string): boolean {
  const lower = text.toLowerCase();
  const banned = [
    "saw your post",
    "i came across",
    "reaching out",
    "passionate about",
    "excited about",
    "great fit",
    "valuable contribution",
    "discuss my fit",
    "hop on a call",
    "i hope this finds you",
    "love to connect",
    "discuss opportunities",
    "same stack as your",
    "sse post",
    "ok to connect",
    "want the two projects",
    "if this is the bar",
  ];
  return banned.some((p) => lower.includes(p));
}

export function asFirstPerson(proof: string): string {
  const text = proof.trim().replace(/\.$/, "");
  if (!text) return text;
  if (/^(i|i'm|i've|i'd)\b/i.test(text)) return text;
  return `I ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

export function looksBrokenConnect(note: string): boolean {
  const lower = note.toLowerCase();
  if (looksGeneric(note)) return true;
  if (!/\bi('m|'ve| built| ran| shipped| work| have)\b/i.test(lower) && !/\bi\b/.test(lower)) return true;
  if (/\bsse post\b/.test(lower)) return true;
  if (/same stack as your/.test(lower)) return true;
  return false;
}

function formatBullets(points: string[]): string {
  return points.filter(Boolean).map((p) => `- ${p.replace(/^[-*•]\s*/, "")}`).join("\n");
}

function sanitizeOption(option: OutreachOption): OutreachOption {
  return {
    id: String(option.id || "proof"),
    label: sanitizeLine(String(option.label || "Draft"), 40),
    why: sanitizeLine(String(option.why || ""), 90),
    message: sanitizeMessage(option.message),
  };
}

export function fallbackDraft(
  profile: OutreachProfile,
  job: OutreachJob,
  resumeUrl = "",
): OutreachDraft {
  const manager = firstName(job.author);
  const candidate = profile.contact.name.trim() || "a candidate";
  const title = profile.filterSummary.currentTitle.trim();
  const company = profile.experience[0]?.company?.trim();
  const who = [candidate, title && `${title}${company ? ` at ${company}` : ""}`]
    .filter(Boolean)
    .join(", ");
  const seenSkills = new Set<string>();
  const skills = [
    ...profile.filterSummary.stack,
    ...profile.skills.languages,
    ...profile.skills.frameworks,
  ].filter((s) => {
    const key = String(s || "").toLowerCase();
    if (!key || seenSkills.has(key)) return false;
    seenSkills.add(key);
    return true;
  }).slice(0, 3);
  const workOn = skills.length > 0 ? skills.join(", ") : "this kind of work";
  const resumeBlock = resumeUrl ? `\n\nIf it is useful, here is my resume:\n${resumeUrl}` : "";
  const resumeShort = resumeUrl ? ` Resume: ${resumeUrl}` : "";

  const warmMessage = [
    `Hi ${manager}, you posted the ${job.title} role at ${job.company}. I work on ${workOn}.`,
    resumeBlock.trim(),
    `${who}. Happy to share more if this is relevant.`,
  ].filter(Boolean).join("\n\n");

  const roleMessage = [
    `Hi ${manager}, the ${job.title} opening at ${job.company} is in my lane. I have been working on ${workOn}.`,
    resumeBlock.trim(),
    "If this is a fit, I am happy to send more.",
  ].filter(Boolean).join("\n\n");

  const connectNote = clipLine(
    `Hi ${manager}, I work on ${workOn}. You posted the ${job.title} role at ${job.company}.${resumeShort} Happy to connect.`,
    CONNECT_NOTE_MAX,
  );

  return sanitizeDraft({
    message: warmMessage,
    connectNote,
    options: [
      { id: "warm", label: "Warm intro", why: "First-contact intro plus resume link.", message: warmMessage },
      { id: "role", label: "Role mention", why: "Names their opening, then offers the resume.", message: roleMessage },
    ],
  });
}

export function sanitizeDraft(draft: OutreachDraft): OutreachDraft {
  const options = (draft.options ?? [])
    .filter((o) => o && typeof o.message === "string")
    .map(sanitizeOption)
    .filter((o) => o.message.length >= 20)
    .slice(0, 2);

  const message = options[0]?.message ?? sanitizeMessage(draft.message);
  if (options.length === 0 && message.length >= 20) {
    options.push({ id: "warm", label: "Warm intro", why: "", message });
  }

  return {
    message,
    connectNote: sanitizeLine(draft.connectNote, CONNECT_NOTE_MAX),
    options,
  };
}

export function sanitizeText(value: string, max: number): string {
  return sanitizeLine(value, max);
}

export function sanitizeMessage(value: string): string {
  let text = String(value ?? "");
  text = text.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(/\\n/g, "\n");
  text = text.replace(/\u2014/g, " - ");
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  text = text.replace(/^["'`]+|["'`]+$/g, "");
  return clipMultiline(text, MESSAGE_MAX);
}

function sanitizeLine(value: string, max: number): string {
  let text = String(value ?? "");
  text = text.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/^["'`]+|["'`]+$/g, "");
  text = text.replace(/\u2014/g, " - ");
  text = text.replace(/\s+/g, " ").trim();
  return clipLine(text, max);
}

function clipLine(text: string, max: number): string {
  if (text.length <= max) return text;
  const sliced = text.slice(0, max - 1);
  const cut = sliced.lastIndexOf(" ");
  return `${(cut > 40 ? sliced.slice(0, cut) : sliced).trimEnd()}…`;
}

function clipMultiline(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function parseOutreachResponse(content: string): OutreachDraft | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  const obj = parsed as {
    message?: unknown;
    dm?: unknown;
    connectNote?: unknown;
    options?: unknown;
  };

  const rawOptions = Array.isArray(obj.options) ? obj.options : [];
  const options: OutreachOption[] = rawOptions
    .filter((o): o is Record<string, unknown> => Boolean(o) && typeof o === "object")
    .filter((o) => o.id !== "connect")
    .map((o, i) => ({
      id: String(o.id ?? (i === 0 ? "warm" : "role")),
      label: String(o.label ?? (i === 0 ? "Warm intro" : "Role mention")),
      why: String(o.why ?? ""),
      message: String(o.message ?? ""),
    }));

  const firstMessage =
    options.find((o) => o.message.trim().length >= 20)?.message
    || (typeof obj.dm === "string" ? obj.dm : "")
    || (typeof obj.message === "string" ? obj.message : "");
  if (String(firstMessage).trim().length < 20) return null;

  const connectNote =
    typeof obj.connectNote === "string" && obj.connectNote.trim().length > 0
      ? obj.connectNote
      : firstMessage;

  return sanitizeDraft({
    message: String(firstMessage),
    connectNote,
    options,
  });
}

function attachResumeLink(text: string, resumeUrl: string, max = MESSAGE_MAX): string {
  if (!resumeUrl || text.includes(resumeUrl)) return text;
  const block = text.includes("resume") ? `\n${resumeUrl}` : `\n\nResume: ${resumeUrl}`;
  if (max === CONNECT_NOTE_MAX) {
    const extra = text.toLowerCase().includes("resume") ? ` ${resumeUrl}` : ` Resume: ${resumeUrl}`;
    return clipLine(`${text.trim()}${extra}`, CONNECT_NOTE_MAX);
  }
  return clipMultiline(`${text.trim()}${block}`, max);
}

function buildAmmoPack(profile: OutreachProfile, job: OutreachJob, resumeUrl = "") {
  return {
    managerFirstName: firstName(job.author),
    resumeUrl,
    workOn: [
      ...profile.filterSummary.stack,
      ...profile.skills.languages,
      ...profile.skills.frameworks,
    ].filter((s, i, arr) => {
      const key = String(s || "").toLowerCase();
      return key && arr.findIndex((x) => String(x).toLowerCase() === key) === i;
    }).slice(0, 6),
    postHooks: extractPostHooks(job),
    candidate: {
      name: profile.contact.name,
      currentTitle: profile.filterSummary.currentTitle,
      roleFamily: profile.filterSummary.roleFamily,
      seniority: profile.filterSummary.seniority,
      location: profile.contact.location ?? "",
      github: profile.contact.github ?? "",
      portfolio: profile.contact.portfolio ?? "",
      skills: [
        ...profile.skills.languages.slice(0, 10),
        ...profile.skills.frameworks.slice(0, 10),
        ...profile.skills.tools.slice(0, 8),
      ],
      certifications: (profile.certifications ?? []).slice(0, 6),
      recentRoles: (profile.experience ?? []).slice(0, 5).map((e) => ({
        title: e.title,
        company: e.company,
        dates: [e.startDate, e.endDate].filter(Boolean).join(" - "),
        bullets: (e.bullets ?? []).slice(0, 5),
      })),
      education: (profile.education ?? []).slice(0, 3),
    },
    hiringPost: {
      author: job.author,
      authorTitle: job.authorTitle,
      title: job.title,
      company: job.company,
      roleFamily: job.roleFamily,
      seniority: job.seniority,
      remoteMode: job.remoteMode,
      stack: job.stack,
      description: job.description.slice(0, 8),
      fullPost: (job.rawText ?? job.description.join("\n")).slice(0, 2000),
    },
  };
}

function ensureConnectGreeting(note: string, manager: string): string {
  const trimmed = note.trim();
  if (!trimmed) return trimmed;
  if (/^hi\s/i.test(trimmed)) return trimmed;
  return clipLine(`Hi ${manager}, ${trimmed.replace(/^[-–—,.\s]+/, "")}`, CONNECT_NOTE_MAX);
}

function finishDraft(
  draft: OutreachDraft,
  fallback: OutreachDraft,
  resumeUrl = "",
): OutreachDraft {
  if (draft.options.length < 2) {
    const extra = fallback.options.find((o) => o.id !== draft.options[0]?.id);
    if (extra) draft.options = [...draft.options, extra];
  }
  if (!draft.connectNote || looksBrokenConnect(draft.connectNote)) {
    draft.connectNote = fallback.connectNote;
  }
  draft.options = draft.options.map((o) =>
    looksGeneric(o.message)
      ? fallback.options.find((f) => f.id === o.id) ?? o
      : o,
  );
  draft.options = draft.options.map((o) => ({
    ...o,
    message: attachResumeLink(o.message, resumeUrl),
  }));
  draft.message = draft.options[0]?.message ?? attachResumeLink(draft.message, resumeUrl);
  draft.connectNote = attachResumeLink(draft.connectNote, resumeUrl, CONNECT_NOTE_MAX);
  return draft;
}

async function requestDraft(
  ammo: ReturnType<typeof buildAmmoPack>,
  retry: boolean,
): Promise<OutreachDraft | null> {
  const extra = retry
    ? "\n\nYour last draft was too salesy. Write a first-contact intro. No metric dump. Include resumeUrl if provided."
    : "";
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `Ammo pack. Use this, invent nothing.\n${JSON.stringify(ammo, null, 2)}\n\n` +
            "Write two short first-contact DMs and a separate connection note. " +
            "This is an introduction, not a pitch. Include resumeUrl when present." +
            extra,
        },
      ],
      temperature: retry ? 0.35 : 0.45,
      max_tokens: 1100,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    console.error(`[Outreach] Groq API error: ${res.status} ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  return typeof content === "string" ? parseOutreachResponse(content) : null;
}

export async function generateOutreachDraft(
  profile: OutreachProfile,
  job: OutreachJob,
  resumeUrl = "",
): Promise<OutreachDraft> {
  const fallback = fallbackDraft(profile, job, resumeUrl);
  if (!GROQ_API_KEY) return fallback;

  try {
    const ammo = buildAmmoPack(profile, job, resumeUrl);
    const parsed = await requestDraft(ammo, false);
    const draft = parsed ?? fallback;
    const weak =
      draft.options.some((o) => looksGeneric(o.message)) || looksGeneric(draft.connectNote);
    if (weak && parsed) {
      const retry = await requestDraft(ammo, true);
      if (retry && !retry.options.some((o) => looksGeneric(o.message))) {
        return finishDraft(retry, fallback, resumeUrl);
      }
    }
    const out = finishDraft(draft, fallback, resumeUrl);
    out.connectNote = ensureConnectGreeting(out.connectNote, firstName(job.author));
    return out;
  } catch (err) {
    console.error("[Outreach] Draft failed:", err);
    return fallback;
  }
}
