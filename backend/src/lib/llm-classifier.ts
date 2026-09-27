// LLM-based classifier using Groq. Falls back to regex if LLM fails or no key.

import {
  isJobPost as regexIsJobPost,
  extractExplicitTitle as regexExtractExplicitTitle,
  extractRoleFamily as regexExtractRoleFamily,
  extractSeniority as regexExtractSeniority,
  extractRemoteMode as regexExtractRemoteMode,
  extractTechStack as regexExtractTechStack,
  extractDescription as regexExtractDescription,
} from "./classifier.js";
import { groqApiKey, groqChatContent } from "./groq.js";

// Must match Prisma TechStack enum
const VALID_TECH_STACKS = [
  "python", "java", "sql", "ai", "aws", "langchain", "rag",
  "react", "llm", "nextjs", "typescript", "nodejs", "go", "rust", "docker",
];

// Must match Prisma RoleFamily enum
export const VALID_ROLE_FAMILIES = [
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
- isJobPost: boolean — true ONLY if the author is recruiting for a specific open role right now (their team, their company, or a concrete opening they want people to apply to). false for thought leadership, market commentary, resume advice, ranting about job descriptions, or posts that only use #hiring / #jobsearch hashtags.
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
4. If the post is someone celebrating being hired ("I got hired", "I accepted an offer"), isJobPost should be false.
5. Hashtags like #hiring, #techcareers, #jobsearch are NOT enough. Ignore them.
6. Opinion / advice posts are not job posts, even if they talk about recruiters, hiring managers, LLMs, or the job market. Signals of commentary: "Do you agree?", "Views are my own", "I see this every week", criticizing JD wording.
7. A specific open role has a real title and an ask to apply, refer, or DM. If you cannot name the position being filled, isJobPost is false.
8. Never return isJobPost true with an empty title. If the post only says the author is hiring, lists a team, or points to a careers page without naming a concrete role, set isJobPost to false and title to "".
9. The title must be a job title, never a location, a company name, a pipe-separated header fragment, or a sentence. "Bengaluru", "| Swiggy | Bengaluru", and "to partner with our sales team" are not titles.
10. Posts by recruiters describing what they recruit for in general (a headline like "Hiring Data Scientists for X") are not job posts unless the post body names one concrete opening.`;

export async function classifyPost(
  text: string,
  authorHeadline?: string,
): Promise<LLMClassification> {
  if (!groqApiKey()) {
    return regexFallback(text);
  }

  try {
    const userContent = authorHeadline
      ? `Author headline: ${authorHeadline}\n\nPost text:\n${text}`
      : `Post text:\n${text}`;

    const content = await groqChatContent({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0,
      max_tokens: 500,
      response_format: { type: "json_object" },
      logPrefix: "[LLM]",
    });
    if (!content) {
      console.error("[LLM] Empty response from Groq");
      return regexFallback(text);
    }

    const parsed = JSON.parse(content) as LLMClassification;
    const llmSaysJob = Boolean(parsed.isJobPost);
    const regexSaysJob = regexIsJobPost(text);
    const llmTitle = typeof parsed.title === "string" ? parsed.title.trim() : "";
    // A job post must name a concrete role: the model's title, else one the
    // post states explicitly. Without either, it is not a job post.
    const title = (llmSaysJob && llmTitle) || regexExtractExplicitTitle(text);
    const isJobPost = (llmSaysJob || regexSaysJob) && title.length > 0;

    // Validate and sanitize
    return {
      isJobPost,
      title: isJobPost ? title : "",
      roleFamily: sanitizeEnum(parsed.roleFamily, VALID_ROLE_FAMILIES, regexExtractRoleFamily(text)),
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
  // Same gate as the LLM path: no explicit title, no job post.
  const title = regexExtractExplicitTitle(text);
  const isJobPost = regexIsJobPost(text) && title.length > 0;
  return {
    isJobPost,
    title: isJobPost ? title : "",
    roleFamily: regexExtractRoleFamily(text),
    seniority: regexExtractSeniority(text),
    remoteMode: regexExtractRemoteMode(text),
    techStack: regexExtractTechStack(text),
    description: regexExtractDescription(text),
  };
}
