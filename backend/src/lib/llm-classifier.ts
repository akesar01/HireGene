// LLM-based classifier using Groq (Llama 3.3 70B) — free, fast.
// Falls back to regex classifier if LLM fails or no API key is set.

import {
  isJobPost as regexIsJobPost,
  extractTitle as regexExtractTitle,
  extractRoleFamily as regexExtractRoleFamily,
  extractSeniority as regexExtractSeniority,
  extractRemoteMode as regexExtractRemoteMode,
  extractTechStack as regexExtractTechStack,
  extractDescription as regexExtractDescription,
} from "./classifier.js";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// Must match Prisma TechStack enum
const VALID_TECH_STACKS = [
  "python", "java", "sql", "ai", "aws", "langchain", "rag",
  "react", "llm", "nextjs", "typescript", "nodejs", "go", "rust", "docker",
];

// Must match Prisma RoleFamily enum
const VALID_ROLE_FAMILIES = [
  "engineering", "ai_ml", "product", "design", "data", "growth",
  "marketing", "content", "ops", "founders_office", "sales",
  "strategy", "finance", "business", "people",
];

const VALID_SENIORITY = ["intern", "junior", "mid", "senior", "lead", "staff", "head"];
const VALID_REMOTE_MODE = ["remote", "hybrid", "in_office"];

interface LLMClassification {
  isJobPost: boolean;
  title: string;
  roleFamily: string;
  seniority: string;
  remoteMode: string;
  techStack: string[];
  description: string[];
}

const SYSTEM_PROMPT = `You are a job post classifier. Given a LinkedIn/X post, determine if it's a genuine hiring post and extract structured data.

Return ONLY valid JSON (no markdown, no explanation) with these fields:
- isJobPost: boolean — true if this is a hiring/job post (someone recruiting or sharing a job opening), false if it's someone talking about being hired, personal updates, etc.
- title: string — the actual job title being hired for (e.g. "Software Engineer II", "Product Manager", "ML Engineer"). Keep it concise. If not a job post, use "".
- roleFamily: string — one of: engineering, ai_ml, product, design, data, growth, marketing, content, ops, founders_office, sales, strategy, finance, business, people
- seniority: string — one of: intern, junior, mid, senior, lead, staff, head
- remoteMode: string — one of: remote, hybrid, in_office (default in_office if not specified)
- techStack: string[] — technologies mentioned, ONLY from this list: python, java, sql, ai, aws, langchain, rag, react, llm, nextjs, typescript, nodejs, go, rust, docker. Use lowercase. Empty array if none match.
- description: string[] — 1-3 key bullet points from the post (qualifications, responsibilities). Keep each under 200 chars. Empty array if not a job post.

CRITICAL RULES:
1. Classify based on the actual ROLE being hired, NOT words that appear in the post. For example, "building the invoicing product" does NOT mean the role is "product" — if the post is hiring a software engineer, roleFamily should be "engineering".
2. The job title should reflect the actual position, not the project or team description. "SDE II" or "Software Development Engineer" are titles; "invoicing ingestion" is a project.
3. If a post describes a role but doesn't explicitly say "hiring" or "looking for", still classify it as a job post if it's clearly describing an open position with qualifications/responsibilities.
4. If the post is someone celebrating being hired ("I got hired", "I accepted an offer"), isJobPost should be false.`;

export async function classifyPost(
  text: string,
  authorHeadline?: string,
): Promise<LLMClassification> {
  // If no API key, fall back to regex immediately
  if (!GROQ_API_KEY) {
    return regexFallback(text);
  }

  try {
    const userContent = authorHeadline
      ? `Author headline: ${authorHeadline}\n\nPost text:\n${text}`
      : `Post text:\n${text}`;

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
          { role: "user", content: userContent },
        ],
        temperature: 0,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.error(`[LLM] Groq API error: ${res.status} ${await res.text()}`);
      return regexFallback(text);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error("[LLM] Empty response from Groq");
      return regexFallback(text);
    }

    const parsed = JSON.parse(content) as LLMClassification;

    // Validate and sanitize
    return {
      isJobPost: Boolean(parsed.isJobPost),
      title: typeof parsed.title === "string" ? parsed.title : regexExtractTitle(text),
      roleFamily: sanitizeEnum(parsed.roleFamily, [
        "engineering", "ai_ml", "product", "design", "data", "growth",
        "marketing", "content", "ops", "founders_office", "sales",
        "strategy", "finance", "business", "people",
      ], regexExtractRoleFamily(text)),
      seniority: sanitizeEnum(parsed.seniority, [
        "intern", "junior", "mid", "senior", "lead", "staff", "head",
      ], regexExtractSeniority(text)),
      remoteMode: sanitizeEnum(parsed.remoteMode, [
        "remote", "hybrid", "in_office",
      ], regexExtractRemoteMode(text)),
      techStack: Array.isArray(parsed.techStack)
        ? parsed.techStack
            .filter((t) => typeof t === "string")
            .map((t) => t.toLowerCase())
            .filter((t) => VALID_TECH_STACKS.includes(t))
        : regexExtractTechStack(text),
      description: Array.isArray(parsed.description)
        ? parsed.description.filter((d) => typeof d === "string" && d.length > 0).slice(0, 3)
        : regexExtractDescription(text),
    };
  } catch (err) {
    console.error("[LLM] Classification failed, falling back to regex:", err);
    return regexFallback(text);
  }
}

function sanitizeEnum(
  value: string,
  allowed: string[],
  fallback: string,
): string {
  const v = String(value ?? "").toLowerCase().trim();
  return allowed.includes(v) ? v : fallback;
}

function regexFallback(text: string): LLMClassification {
  return {
    isJobPost: regexIsJobPost(text),
    title: regexExtractTitle(text),
    roleFamily: regexExtractRoleFamily(text),
    seniority: regexExtractSeniority(text),
    remoteMode: regexExtractRemoteMode(text),
    techStack: regexExtractTechStack(text),
    description: regexExtractDescription(text),
  };
}
