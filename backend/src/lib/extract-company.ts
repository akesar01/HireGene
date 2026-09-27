// Infer the hiring company from a recruiter headline and/or post body.

const GENERIC_SEGMENTS = new Set([
  "talent acquisition",
  "talent acquisition specialist",
  "talent acquisition manager",
  "talent acquisition expert",
  "talent partner",
  "talent sourcer",
  "tech hiring",
  "technical recruiter",
  "it recruiter",
  "campus",
  "lateral hiring",
  "tech recruitment",
  "candidate experience",
  "employer branding",
  "human resource",
  "mentoring",
  "apac",
  "hiring",
  "recruiting",
  "head hunting",
  "strategic hiring",
  "leadership",
  "executive search",
  "followers",
]);

/** Places that sometimes leak into the company slot from pipe headers. */
export const LOCATION_WORDS = new Set([
  "bengaluru",
  "bangalore",
  "hyderabad",
  "pune",
  "chennai",
  "delhi",
  "delhi ncr",
  "gurugram",
  "gurgaon",
  "noida",
  "mumbai",
  "kolkata",
  "remote",
  "india",
]);

export const MAX_COMPANY_LENGTH = 40;

/** Lowercase words that start a sentence fragment rather than a brand name. */
const FRAGMENT_LEAD_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "our", "we", "you", "your", "this", "that",
  "these", "those", "with", "for", "to", "of", "in", "on", "at", "by", "from", "as",
  "is", "are", "be", "it", "its", "if", "so", "more", "most", "some", "all", "any",
  "new", "join", "build", "building", "work", "working", "help", "helping", "scale",
  "massive", "growing", "fast", "leading", "world", "one", "top", "best", "global",
]);

/**
 * True when a company value looks like a sentence fragment, a city, or is
 * otherwise not a name we want on a job card. "Unknown" is allowed.
 */
export function isSuspiciousCompany(value: string): boolean {
  const name = value.trim();
  if (!name) return true;
  if (name.toLowerCase() === "unknown") return false;
  if (name.length > MAX_COMPANY_LENGTH) return true;
  if (LOCATION_WORDS.has(name.toLowerCase())) return true;
  if (/ (?:and|the) /.test(name)) return true;
  const words = name.split(/\s+/);
  const first = words[0] ?? "";
  if (/^[a-z]+$/.test(first)) {
    if (FRAGMENT_LEAD_WORDS.has(first)) return true;
    if (words.length >= 3) return true;
  }
  return false;
}

/** Drop "lEx-JPMorganl", "| Ex-Amazon", "(Ex-Amazon)" style headline noise. */
function stripHeadlineNoise(raw: string): string {
  return raw
    .replace(/[|(\[]?\s*\bl?ex-[A-Za-z0-9&.+\-]*l?[)\]]?/gi, " ")
    .replace(/[|]+/g, " | ")
    .replace(/\s+/g, " ")
    .replace(/^(?:\s*\|\s*)+/, "")
    .replace(/(?:\s*\|\s*)+$/, "")
    .trim();
}

const SENTENCE_END = /[.!?,](?:\s|$)|\n/;

const STOP_AFTER = /\s+(?:[-–—|•]|\bapply now\b|\bwe'?re (?:looking|hiring)\b|#)/i;

export function cleanCompanyName(raw: string): string {
  let name = stripHeadlineNoise(raw.replace(/[#*]/g, " "));
  if (name.includes("|")) name = name.split("|")[0]?.trim() ?? "";
  name = name.replace(/[.,;:!]+$/g, "").trim();
  name = name.replace(/^(?:the|our)\s+/i, "").trim();
  name = name.replace(/\s+(?:for|in|on|to|with|and)$/i, "").trim();
  const stop = new Set(["we", "we're", "were", "looking", "if", "are", "i'm", "im", "i", "click", "apply", "dm"]);
  const words = name.split(/\s+/);
  const kept: string[] = [];
  for (const w of words) {
    if (stop.has(w.toLowerCase().replace(/[^a-z']/g, ""))) break;
    kept.push(w);
  }
  name = kept.join(" ").trim();
  if (name.length < 2 || name.length > 60) return "";
  if (GENERIC_SEGMENTS.has(name.toLowerCase())) return "";
  if (/^\d/.test(name)) return "";
  if (/followers/i.test(name)) return "";
  if (/\.(com|io|ai|in|org)$/i.test(name)) {
    name = name.replace(/\.(com|io|ai|in|org)$/i, "");
    if (name.length < 3) return "";
  }
  const wordCount = name.split(/\s+/).length;
  const looksLikeFirm = /\b(corp|inc|llc|ltd|labs|games|tech|technologies|global|india|ai)\b/i.test(name);
  if (wordCount >= 4 && !looksLikeFirm) return "";
  if (isSuspiciousCompany(name)) return "";
  return name;
}

function fromAtPhrase(text: string): string | null {
  const atSymbol = text.match(/@\s*([A-Za-z0-9&+\- ]{2,50})/);
  if (atSymbol) {
    const cut = atSymbol[1].split(STOP_AFTER)[0] ?? atSymbol[1];
    const cleaned = cleanCompanyName(cut);
    if (cleaned) return cleaned;
  }
  const atWord = text.match(/\bat\s+([A-Za-z0-9&+\- ]{2,50})/i);
  if (atWord) {
    const cut = atWord[1].split(STOP_AFTER)[0] ?? atWord[1];
    const cleaned = cleanCompanyName(cut);
    if (cleaned) return cleaned;
  }
  return null;
}

function fromHiringLine(text: string): string | null {
  const isHiring = text.match(
    /\b([A-Za-z0-9&.+\-][A-Za-z0-9&.+\- ]{1,40}?)\s+is\s+hiring\b/i,
  );
  if (isHiring) {
    const cleaned = cleanCompanyName(isHiring[1]);
    if (cleaned) return cleaned;
  }
  const pipeCompany = text.match(
    /(?:we'?re hiring|hiring)\s*\|\s*[^|\n]{3,80}\|\s*([A-Za-z0-9&.+\- ]{2,40})/i,
  );
  if (pipeCompany) {
    // Stop at the end of the sentence: "| Baazi Games. Kubernetes, AWS" -> "Baazi Games".
    const cleaned = cleanCompanyName(pipeCompany[1].split(SENTENCE_END)[0] ?? "");
    if (cleaned) return cleaned;
  }
  return null;
}

function fromHeadlinePipes(headline: string): string | null {
  const parts = headline.split("|").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (GENERIC_SEGMENTS.has(lower)) continue;
    if (/\b(hiring|recruiter|recruitment|acquisition|hrbp|campus|sourcing)\b/i.test(part)
      && !/\b(walmart|amazon|google|microsoft|meta|netflix|tekion|nielsen|moengage)\b/i.test(part)) {
      continue;
    }
    if (/\b(india|global tech|corp|games|technologies|labs|ai)\b/i.test(part) || /^[A-Z][A-Za-z0-9&.+\- ]{1,40}$/.test(part)) {
      const cleaned = cleanCompanyName(part.replace(/\s+hiring.*$/i, ""));
      if (cleaned && !GENERIC_SEGMENTS.has(cleaned.toLowerCase())) return cleaned;
    }
  }
  return null;
}

export function extractCompanyFromHeadline(headline: string): string | null {
  if (!headline?.trim()) return null;
  return fromAtPhrase(headline) ?? fromHeadlinePipes(headline);
}

export function extractCompanyFromPost(rawText: string): string | null {
  if (!rawText?.trim()) return null;
  const head = rawText.slice(0, 500);
  const firstLine = (rawText.split(/\n/)[0] ?? "").trim();
  const lastPipe = firstLine.match(/\|\s*([A-Za-z0-9&.+\- ]{2,40})\s*$/);
  const fromLastPipe = lastPipe ? cleanCompanyName(lastPipe[1]) : "";
  return fromAtPhrase(head) ?? fromHiringLine(head) ?? (fromLastPipe || null);
}

export function inferCompany(input: {
  headline?: string | null;
  rawText?: string | null;
  fallbacks?: Array<string | null | undefined>;
}): string {
  const fromPost = extractCompanyFromPost(input.rawText ?? "");
  const fromHeadline = extractCompanyFromHeadline(input.headline ?? "");
  const found = fromPost || fromHeadline;
  const fallbacks = (input.fallbacks ?? [])
    .map((fb) => cleanCompanyName(String(fb ?? "")))
    .filter((fb) => fb && fb.toLowerCase() !== "unknown");
  if (found) {
    const richer = fallbacks.find(
      (fb) => fb.toLowerCase().includes(found.toLowerCase()) && fb.length > found.length,
    );
    return richer || found;
  }
  return fallbacks[0] || "Unknown";
}
