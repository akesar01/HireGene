// LLM match scorer using Groq — refines match scores for top jobs.
// Reuses the same Groq API pattern as llm-classifier.ts.

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export interface MatchJobInput {
  id: string;
  title: string;
  description: string[];
  stack: string[];
  roleFamily: string;
  seniority: string;
  remoteMode: string;
}

export interface MatchResult {
  jobId: string;
  score: number;
  reason: string;
}

interface ProfileInput {
  filterSummary: {
    currentTitle: string;
    roleFamily: string;
    seniority: string;
    remoteMode: string;
    stack: string[];
  };
  skills: {
    languages: string[];
    frameworks: string[];
    tools: string[];
  };
  experience: { title: string; company: string }[];
}

const SYSTEM_PROMPT = `You are a job match evaluator. Given a candidate's profile and a list of jobs, score each job 0-100 for this candidate.

Return ONLY a valid JSON array (no markdown, no explanation) with this format:
[{"jobId": "string", "score": number, "reason": "string"}]

Rules:
1. score is an integer 0-100 representing how well the job matches the candidate.
2. reason is a single concise sentence (under 100 chars) explaining the score.
3. Consider: role family match, seniority alignment, tech stack overlap, remote mode preference, and how well the candidate's skills/experience fit the job description.
4. Higher scores = better match. A perfect role/seniority/stack match should be 85-95.
5. Return one entry per job provided.`;

export async function refineMatches(
  profile: ProfileInput,
  jobs: MatchJobInput[],
): Promise<MatchResult[]> {
  if (!GROQ_API_KEY || jobs.length === 0) {
    return [];
  }

  try {
    const candidateSummary = {
      currentTitle: profile.filterSummary.currentTitle,
      roleFamily: profile.filterSummary.roleFamily,
      seniority: profile.filterSummary.seniority,
      remoteMode: profile.filterSummary.remoteMode,
      stack: profile.filterSummary.stack,
      topSkills: [
        ...profile.skills.languages.slice(0, 5),
        ...profile.skills.frameworks.slice(0, 5),
        ...profile.skills.tools.slice(0, 3),
      ],
      recentRoles: profile.experience.slice(0, 3).map((e) => `${e.title} at ${e.company}`),
    };

    const jobsSummary = jobs.map((j) => ({
      id: j.id,
      title: j.title,
      description: j.description.slice(0, 2).join(" "),
      stack: j.stack,
      roleFamily: j.roleFamily,
      seniority: j.seniority,
      remoteMode: j.remoteMode,
    }));

    const userContent = `Candidate profile:\n${JSON.stringify(candidateSummary, null, 2)}\n\nJobs to score:\n${JSON.stringify(jobsSummary, null, 2)}`;

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
        max_tokens: 1000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.error(`[Match] Groq API error: ${res.status} ${await res.text()}`);
      return [];
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error("[Match] Empty response from Groq");
      return [];
    }

    const parsed = JSON.parse(content);
    const results = Array.isArray(parsed) ? parsed : parsed.matches ?? parsed.results ?? [];

    if (!Array.isArray(results)) {
      console.error("[Match] Unexpected response format");
      return [];
    }

    return results
      .filter((r: any) => r && typeof r.jobId === "string")
      .map((r: any) => ({
        jobId: String(r.jobId),
        score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))),
        reason: String(r.reason ?? ""),
      }));
  } catch (err) {
    console.error("[Match] Scoring failed:", err);
    return [];
  }
}
