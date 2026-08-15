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

const STOP_AFTER = /\s+(?:[-–—|•]|\bapply now\b|\bwe'?re (?:looking|hiring)\b|#)/i;

export function cleanCompanyName(raw: string): string {
  let name = raw.replace(/[#*]/g, " ").replace(/\s+/g, " ").trim();
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
    const cleaned = cleanCompanyName(pipeCompany[1]);
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
