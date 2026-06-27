import { Hono } from "hono";
import type { Collection } from "mongodb";
import { getProfilesCollection } from "../lib/mongo.js";
import { parseResume, type ResumeData } from "../lib/resume-parser.js";
import { extractTextFromPDF } from "../lib/pdf-extract.js";
import { refineMatches, type MatchJobInput } from "../lib/match-scorer.js";

type Variables = {
  userId: string | null;
};

const profile = new Hono<{ Variables: Variables }>();

interface ProfileDoc {
  _id: string;
  contact: ResumeData["contact"];
  experience: ResumeData["experience"];
  education: ResumeData["education"];
  certifications: string[];
  skills: ResumeData["skills"];
  filterSummary: ResumeData["filterSummary"];
  createdAt: Date;
  updatedAt: Date;
}

async function getCollection(): Promise<Collection<ProfileDoc> | null> {
  return getProfilesCollection() as unknown as Promise<Collection<ProfileDoc> | null>;
}

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

function sanitizeEnum(value: string, allowed: string[], fallback: string): string {
  const v = value.toLowerCase().trim();
  return allowed.includes(v) ? v : fallback;
}

// GET /api/profile — fetch user's resume profile
profile.get("/", async (c) => {
  const userId = c.get("userId") as string | null;
  if (!userId) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const collection = await getCollection();
  if (!collection) {
    return c.json({ error: "Profile service unavailable" }, 503);
  }

  const doc = await collection.findOne({ _id: userId } as any);
  if (!doc) {
    return c.json({ profile: null });
  }

  return c.json({ profile: doc });
});

// POST /api/profile/resume — upload and parse resume
profile.post("/resume", async (c) => {
  const userId = c.get("userId") as string | null;
  if (!userId) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const collection = await getCollection();
  if (!collection) {
    return c.json({ error: "Profile service unavailable" }, 503);
  }

  let file: File | undefined;
  try {
    const body = await c.req.parseBody();
    file = body.file as File;
  } catch {
    return c.json({ error: "Failed to parse form data" }, 400);
  }

  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }

  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: "File too large. Max 5MB." }, 400);
  }

  // Validate file type
  const fileName = file.name.toLowerCase();
  const isPdf = fileName.endsWith(".pdf");
  const isTxt = fileName.endsWith(".txt");
  if (!isPdf && !isTxt) {
    return c.json({ error: "Only PDF and TXT files are supported" }, 400);
  }

  // Extract text
  let text: string;
  try {
    if (isPdf) {
      const buffer = Buffer.from(await file.arrayBuffer());
      text = await extractTextFromPDF(buffer);
    } else {
      text = await file.text();
    }
  } catch {
    return c.json({ error: "Failed to extract text from file" }, 500);
  }

  if (!text || text.trim().length < 50) {
    return c.json({ error: "Could not extract enough text from the file. Try a different format." }, 400);
  }

  // Parse resume via Groq
  const resumeData: ResumeData = await parseResume(text);

  // Upsert into MongoDB
  const now = new Date();

  await collection.updateOne(
    { _id: userId } as any,
    {
      $set: {
        contact: resumeData.contact,
        experience: resumeData.experience,
        education: resumeData.education,
        certifications: resumeData.certifications,
        skills: resumeData.skills,
        filterSummary: resumeData.filterSummary,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  const savedDoc = await collection.findOne({ _id: userId } as any);
  return c.json({ profile: savedDoc });
});

// PUT /api/profile — update filter preferences manually
profile.put("/", async (c) => {
  const userId = c.get("userId") as string | null;
  if (!userId) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const collection = await getCollection();
  if (!collection) {
    return c.json({ error: "Profile service unavailable" }, 503);
  }

  let body: {
    currentTitle?: string;
    roleFamily?: string;
    seniority?: string;
    remoteMode?: string;
    stack?: string[];
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const filterSummary = {
    currentTitle: String(body.currentTitle ?? ""),
    roleFamily: sanitizeEnum(body.roleFamily ?? "", VALID_ROLE_FAMILIES, "engineering"),
    seniority: sanitizeEnum(body.seniority ?? "", VALID_SENIORITY, "mid"),
    remoteMode: sanitizeEnum(body.remoteMode ?? "", VALID_REMOTE_MODE, "remote"),
    stack: Array.isArray(body.stack)
      ? body.stack
          .map((s: string) => s.toLowerCase())
          .filter((s: string) => VALID_TECH_STACKS.includes(s))
      : [],
  };

  const now = new Date();
  const existing = await collection.findOne({ _id: userId } as any);

  if (existing) {
    await collection.updateOne(
      { _id: userId } as any,
      { $set: { filterSummary, updatedAt: now } },
    );
  } else {
    await collection.insertOne({
      _id: userId as any,
      contact: { name: "", email: "", phone: "", location: "", linkedin: "", github: "", portfolio: "" },
      experience: [],
      education: [],
      certifications: [],
      skills: { languages: [], frameworks: [], tools: [], soft: [] },
      filterSummary,
      createdAt: now,
      updatedAt: now,
    } as any);
  }

  const savedDoc = await collection.findOne({ _id: userId } as any);
  return c.json({ profile: savedDoc });
});

// POST /api/profile/match — LLM-refined match scores for top jobs
profile.post("/match", async (c) => {
  const userId = c.get("userId") as string | null;
  if (!userId) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const collection = await getCollection();
  if (!collection) {
    return c.json({ error: "Profile service unavailable" }, 503);
  }

  const userDoc = await collection.findOne({ _id: userId } as any);
  if (!userDoc) {
    return c.json({ error: "No profile found. Upload a resume first." }, 404);
  }

  let body: { jobs: MatchJobInput[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!Array.isArray(body.jobs) || body.jobs.length === 0) {
    return c.json({ error: "jobs array is required" }, 400);
  }

  // Limit to 5 jobs for LLM scoring
  const topJobs = body.jobs.slice(0, 5);
  const matches = await refineMatches(userDoc as any, topJobs);

  return c.json({ matches });
});

export default profile;
