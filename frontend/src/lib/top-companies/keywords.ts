const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "have", "has", "had",
  "was", "were", "are", "been", "being", "will", "would", "could", "should",
  "into", "over", "under", "about", "after", "before", "between", "through",
  "your", "you", "our", "their", "they", "them", "his", "her", "she", "him",
  "not", "but", "all", "any", "can", "may", "also", "such", "than", "then",
  "when", "where", "what", "which", "who", "how", "why", "its", "it",
  "using", "used", "use", "via", "per", "etc", "including", "include",
  "work", "worked", "working", "team", "teams", "role", "roles", "job",
  "experience", "experienced", "skills", "skill", "responsible",
  "responsibilities", "project", "projects", "company", "companies",
  "university", "college", "education", "summary", "objective", "profile",
  "professional", "years", "year", "month", "months", "present", "current",
  "strong", "highly", "driven", "passionate", "motivated", "looking",
  "india", "united", "states", "remote",
]);

const TITLE_PHRASES = [
  "software development engineer",
  "senior software engineer",
  "staff software engineer",
  "principal software engineer",
  "machine learning engineer",
  "machine learning scientist",
  "applied scientist",
  "research scientist",
  "data scientist",
  "data engineer",
  "data analyst",
  "business analyst",
  "business intelligence",
  "product manager",
  "technical program manager",
  "program manager",
  "project manager",
  "solutions architect",
  "cloud architect",
  "security engineer",
  "devops engineer",
  "site reliability engineer",
  "frontend engineer",
  "front end engineer",
  "backend engineer",
  "full stack engineer",
  "fullstack engineer",
  "ios engineer",
  "android engineer",
  "mobile engineer",
  "qa engineer",
  "quality engineer",
  "ux designer",
  "product designer",
  "software engineer",
  "systems engineer",
  "network engineer",
  "financial analyst",
  "operations manager",
  "account manager",
  "recruiter",
];

const SKILL_ALIASES: Record<string, string> = {
  "c++": "cplusplus",
  "c#": "csharp",
  "node.js": "nodejs",
  "next.js": "nextjs",
  "react.js": "react",
  "vue.js": "vue",
  "ci/cd": "cicd",
};

export interface ResumeSignals {
  query: string;
  keywords: string[];
  titles: string[];
  inferredLocation: string;
}

function normalize(text: string): string {
  let next = text.toLowerCase();
  for (const [from, to] of Object.entries(SKILL_ALIASES)) {
    next = next.split(from).join(` ${to} `);
  }
  return next;
}

function tokenize(text: string): string[] {
  return normalize(text)
    .replace(/[^a-z0-9+]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => {
      if (!t) return false;
      if (t.length <= 2 && !["go", "ml", "ai", "sde", "pm", "qa", "ux", "ui", "js"].includes(t)) {
        return false;
      }
      if (STOPWORDS.has(t)) return false;
      if (/^\d+$/.test(t)) return false;
      return true;
    });
}

const CITY_PATTERN = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*([A-Z]{2})\b/;
const NOT_A_CITY = new Set([
  "python", "java", "react", "node", "aws", "sql", "golang",
]);

const KNOWN_CITIES = [
  "seattle", "bellevue", "austin", "boston", "chicago", "denver",
  "atlanta", "dallas", "houston", "phoenix", "portland", "nashville",
  "arlington", "hyderabad", "bangalore", "bengaluru", "dublin",
  "london", "toronto", "vancouver", "new york", "san francisco",
  "sunnyvale", "cupertino", "redmond",
];

export function extractResumeSignals(resumeText: string): ResumeSignals {
  const raw = resumeText.trim();
  const lower = normalize(raw);
  const titles = TITLE_PHRASES.filter((phrase) => lower.includes(phrase));

  const tokens = tokenize(raw);
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  const keywords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 40)
    .map(([token]) => token);

  const query = titles[0] ?? keywords.slice(0, 4).join(" ") ?? "software engineer";

  let inferredLocation = "";
  const cityMatch = raw.match(CITY_PATTERN);
  if (cityMatch && !NOT_A_CITY.has(cityMatch[1].toLowerCase())) {
    inferredLocation = cityMatch[0];
  } else {
    inferredLocation = KNOWN_CITIES.find((city) => lower.includes(city)) ?? "";
  }

  return { query, keywords, titles, inferredLocation };
}

export function scoreJobText(
  job: { title: string; description: string; qualifications: string; category: string },
  signals: ResumeSignals,
): { score: number; reason: string } {
  if (signals.keywords.length === 0 && signals.titles.length === 0) {
    return { score: 0, reason: "No resume keywords to match" };
  }

  const title = normalize(job.title);
  const quals = normalize(job.qualifications);
  const desc = normalize(job.description);
  const category = normalize(job.category);
  const haystack = `${title} ${quals} ${desc} ${category}`;

  let weighted = 0;
  let hits = 0;
  const matched: string[] = [];

  for (const phrase of signals.titles) {
    if (title.includes(phrase)) {
      weighted += 12;
      hits += 1;
      if (matched.length < 4) matched.push(phrase);
    } else if (haystack.includes(phrase)) {
      weighted += 6;
      hits += 1;
    }
  }

  for (const keyword of signals.keywords) {
    if (title.includes(keyword)) {
      weighted += 5;
      hits += 1;
      if (matched.length < 6) matched.push(keyword);
    } else if (quals.includes(keyword)) {
      weighted += 3;
      hits += 1;
    } else if (desc.includes(keyword) || category.includes(keyword)) {
      weighted += 1;
      hits += 1;
    }
  }

  const denom = Math.max(signals.titles.length * 12 + signals.keywords.length * 3, 1);
  const score = Math.max(0, Math.min(99, Math.round((weighted / denom) * 100)));
  const reason = matched.length > 0
    ? `Matched ${matched.slice(0, 4).join(", ")}`
    : hits > 0
      ? "Partial overlap with your resume"
      : "Weak overlap with your resume";

  return { score, reason };
}
