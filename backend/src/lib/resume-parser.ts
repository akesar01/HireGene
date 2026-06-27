// Resume parser using Groq (Llama 3.3 70B) — extracts full structured data from resume text.
// Reuses the same Groq API pattern as llm-classifier.ts.

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// Must match Prisma enums — used for filterSummary
const VALID_ROLE_FAMILIES = [
  "engineering", "ai_ml", "product", "design", "data", "growth",
  "marketing", "content", "ops", "founders_office", "sales",
  "strategy", "finance", "business", "people",
];

const VALID_SENIORITY = ["intern", "junior", "mid", "senior", "lead", "staff", "head"];
const VALID_REMOTE_MODE = ["remote", "hybrid", "in_office"];
const VALID_TECH_STACKS = [
  "python", "java", "sql", "ai", "aws", "langchain", "rag",
  "react", "llm", "nextjs", "typescript", "nodejs", "go", "rust", "docker",
];

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface ExperienceItem {
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface EducationItem {
  degree: string;
  institution: string;
  graduationYear: string;
  gpa: string;
}

export interface Skills {
  languages: string[];
  frameworks: string[];
  tools: string[];
  soft: string[];
}

export interface FilterSummary {
  currentTitle: string;
  roleFamily: string;
  seniority: string;
  remoteMode: string;
  stack: string[];
}

export interface ResumeData {
  contact: ContactInfo;
  experience: ExperienceItem[];
  education: EducationItem[];
  certifications: string[];
  skills: Skills;
  filterSummary: FilterSummary;
}

const SYSTEM_PROMPT = `You are a resume parser. Extract structured data from resume text and return ONLY valid JSON (no markdown, no explanation).

Return a JSON object with these fields:

contact: {
  name: string — full name of the person
  email: string — email address, "" if not found
  phone: string — phone number, "" if not found
  location: string — city/state or country, "" if not found
  linkedin: string — LinkedIn URL or username, "" if not found
  github: string — GitHub URL or username, "" if not found
  portfolio: string — personal website/portfolio URL, "" if not found
}

experience: array of {
  title: string — job title
  company: string — company name
  startDate: string — e.g. "Jan 2022" or "2022"
  endDate: string — e.g. "Present" or "Dec 2023"
  bullets: string[] — 2-4 achievement bullets from this role
}

education: array of {
  degree: string — e.g. "B.Tech in Computer Science"
  institution: string — university/college name
  graduationYear: string — e.g. "2022"
  gpa: string — e.g. "3.8/4.0" or "" if not found
}

certifications: string[] — array of certification names, empty if none

skills: {
  languages: string[] — programming languages (e.g. Python, JavaScript, Go)
  frameworks: string[] — frameworks/libraries (e.g. React, Django, Spring)
  tools: string[] — tools/platforms (e.g. Docker, Kubernetes, Jira)
  soft: string[] — soft skills (e.g. Leadership, Communication)
}

filterSummary: {
  currentTitle: string — their most recent or current job title
  roleFamily: string — MUST be one of: ${VALID_ROLE_FAMILIES.join(", ")}
  seniority: string — MUST be one of: ${VALID_SENIORITY.join(", ")}. Infer from years of experience: 0-1=intern, 1-3=junior, 3-6=mid, 6-10=senior, 10-15=lead, 15-20=staff, 20+=head
  remoteMode: string — MUST be one of: ${VALID_REMOTE_MODE.join(", ")}. Infer from location/keywords (remote, hybrid, on-site). Default "remote" if unclear.
  stack: string[] — technologies from the resume, ONLY from this list: ${VALID_TECH_STACKS.join(", ")}. Use lowercase. Empty array if none match.
}

CRITICAL RULES:
1. Return ONLY valid JSON. No markdown, no code fences, no explanations.
2. If a field is not found in the resume, use empty string "" for strings, empty array [] for arrays.
3. For filterSummary.stack, only include technologies that match the allowed list. Map common variations (e.g. "JavaScript" → not in list, skip; "TypeScript" → "typescript"; "React.js" → "react").
4. For filterSummary.seniority, infer from total years of experience across all roles, not just the latest role.
5. Keep bullet points concise — under 200 chars each.`;

function sanitizeEnum(value: unknown, allowed: string[], fallback: string): string {
  const v = String(value ?? "").toLowerCase().trim();
  return allowed.includes(v) ? v : fallback;
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string" && v.length > 0);
}

function emptyResumeData(): ResumeData {
  return {
    contact: { name: "", email: "", phone: "", location: "", linkedin: "", github: "", portfolio: "" },
    experience: [],
    education: [],
    certifications: [],
    skills: { languages: [], frameworks: [], tools: [], soft: [] },
    filterSummary: { currentTitle: "", roleFamily: "engineering", seniority: "mid", remoteMode: "remote", stack: [] },
  };
}

export async function parseResume(text: string): Promise<ResumeData> {
  if (!GROQ_API_KEY) {
    console.warn("[Resume] No GROQ_API_KEY set — returning empty profile");
    return emptyResumeData();
  }

  if (!text || text.trim().length < 50) {
    console.warn("[Resume] Text too short to parse");
    return emptyResumeData();
  }

  try {
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
          { role: "user", content: `Resume text:\n${text}` },
        ],
        temperature: 0,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.error(`[Resume] Groq API error: ${res.status} ${await res.text()}`);
      return emptyResumeData();
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error("[Resume] Empty response from Groq");
      return emptyResumeData();
    }

    const parsed = JSON.parse(content);

    // Sanitize and validate
    return {
      contact: {
        name: String(parsed.contact?.name ?? ""),
        email: String(parsed.contact?.email ?? ""),
        phone: String(parsed.contact?.phone ?? ""),
        location: String(parsed.contact?.location ?? ""),
        linkedin: String(parsed.contact?.linkedin ?? ""),
        github: String(parsed.contact?.github ?? ""),
        portfolio: String(parsed.contact?.portfolio ?? ""),
      },
      experience: Array.isArray(parsed.experience)
        ? parsed.experience
            .filter((e: unknown) => e && typeof e === "object")
            .map((e: any) => ({
              title: String(e.title ?? ""),
              company: String(e.company ?? ""),
              startDate: String(e.startDate ?? ""),
              endDate: String(e.endDate ?? ""),
              bullets: ensureStringArray(e.bullets),
            }))
        : [],
      education: Array.isArray(parsed.education)
        ? parsed.education
            .filter((e: unknown) => e && typeof e === "object")
            .map((e: any) => ({
              degree: String(e.degree ?? ""),
              institution: String(e.institution ?? ""),
              graduationYear: String(e.graduationYear ?? ""),
              gpa: String(e.gpa ?? ""),
            }))
        : [],
      certifications: ensureStringArray(parsed.certifications),
      skills: {
        languages: ensureStringArray(parsed.skills?.languages),
        frameworks: ensureStringArray(parsed.skills?.frameworks),
        tools: ensureStringArray(parsed.skills?.tools),
        soft: ensureStringArray(parsed.skills?.soft),
      },
      filterSummary: {
        currentTitle: String(parsed.filterSummary?.currentTitle ?? ""),
        roleFamily: sanitizeEnum(parsed.filterSummary?.roleFamily, VALID_ROLE_FAMILIES, "engineering"),
        seniority: sanitizeEnum(parsed.filterSummary?.seniority, VALID_SENIORITY, "mid"),
        remoteMode: sanitizeEnum(parsed.filterSummary?.remoteMode, VALID_REMOTE_MODE, "remote"),
        stack: ensureStringArray(parsed.filterSummary?.stack)
          .map((s) => s.toLowerCase())
          .filter((s) => VALID_TECH_STACKS.includes(s)),
      },
    };
  } catch (err) {
    console.error("[Resume] Parsing failed:", err);
    return emptyResumeData();
  }
}
