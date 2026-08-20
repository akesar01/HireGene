import { randomBytes } from "crypto";
import { Hono } from "hono";
import type { Collection } from "mongodb";
import { getProfilesCollection } from "../lib/mongo.js";
import { parseResume, type ResumeData } from "../lib/resume-parser.js";
import { extractTextFromPDF } from "../lib/pdf-extract.js";
import { refineMatches, type MatchJobInput } from "../lib/match-scorer.js";
import { prisma } from "../lib/prisma.js";
import {
  generateOutreachDraft,
  profileHasOutreachContext,
  resolveOpenUrl,
  type OutreachProfile,
} from "../lib/outreach-draft.js";
import {
  isPdfBuffer,
  loadResumePdfBySlug,
  saveResumePdf,
} from "../lib/resume-storage.js";

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
  shareSlug?: string;
  resumeFileId?: string;
  resumeFileName?: string;
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

function newShareSlug(): string {
  return randomBytes(9).toString("base64url");
}

function publicResumeUrl(slug: string): string {
  const origin = (process.env.FRONTEND_URL ?? "https://skiptheboard.in").replace(/\/$/, "");
  return `${origin}/r/${slug}`;
}

function publicResumePdfUrl(c: { req: { url: string } }, slug: string): string {
  const origin = new URL(c.req.url).origin;
  return `${origin}/api/profile/public/${encodeURIComponent(slug)}/file`;
}

async function ensureShareSlug(
  collection: Collection<ProfileDoc>,
  userId: string,
  existing?: string,
): Promise<string> {
  if (existing) return existing;
  const shareSlug = newShareSlug();
  await collection.updateOne(
    { _id: userId } as any,
    { $set: { shareSlug, updatedAt: new Date() } },
  );
  return shareSlug;
}

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

  const shareSlug = await ensureShareSlug(collection, userId, doc.shareSlug);
  const hasPdf = Boolean(doc.resumeFileId);
  return c.json({
    profile: {
      ...doc,
      shareSlug,
      hasPdf,
      resumeUrl: publicResumeUrl(shareSlug),
      pdfUrl: hasPdf ? publicResumePdfUrl(c, shareSlug) : null,
    },
  });
});

// GET /api/profile/public/:slug/file — original uploaded PDF (no auth)
profile.get("/public/:slug/file", async (c) => {
  const slug = c.req.param("slug")?.trim();
  if (!slug) return c.json({ error: "Not found" }, 404);

  const file = await loadResumePdfBySlug(slug);
  if (!file) return c.json({ error: "Resume PDF not found" }, 404);

  return c.body(new Uint8Array(file.bytes), 200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${file.fileName}"`,
    "Cache-Control": "private, max-age=300",
  });
});

// GET /api/profile/public/:slug — hosted resume page data (no auth)
profile.get("/public/:slug", async (c) => {
  const slug = c.req.param("slug")?.trim();
  if (!slug) return c.json({ error: "Not found" }, 404);

  const collection = await getCollection();
  if (!collection) {
    return c.json({ error: "Profile service unavailable" }, 503);
  }

  const doc = await collection.findOne({ shareSlug: slug } as any);
  if (!doc) return c.json({ error: "Not found" }, 404);

  const hasPdf = Boolean(doc.resumeFileId);
  return c.json({
    profile: {
      contact: {
        name: doc.contact?.name ?? "",
        email: doc.contact?.email ?? "",
        phone: "",
        location: doc.contact?.location ?? "",
        linkedin: doc.contact?.linkedin ?? "",
        github: doc.contact?.github ?? "",
        portfolio: doc.contact?.portfolio ?? "",
      },
      experience: doc.experience ?? [],
      education: doc.education ?? [],
      certifications: doc.certifications ?? [],
      skills: doc.skills,
      filterSummary: doc.filterSummary,
      hasPdf,
      pdfUrl: hasPdf ? publicResumePdfUrl(c, slug) : null,
    },
  });
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

  // Extract text and keep the original PDF bytes for sharing
  let text: string;
  let pdfBytes: Buffer | null = null;
  try {
    if (isPdf) {
      pdfBytes = Buffer.from(await file.arrayBuffer());
      if (!isPdfBuffer(pdfBytes)) {
        return c.json({ error: "That file is not a valid PDF." }, 400);
      }
      text = await extractTextFromPDF(pdfBytes);
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
      $setOnInsert: { createdAt: now, shareSlug: newShareSlug() },
    },
    { upsert: true },
  );

  const savedDoc = await collection.findOne({ _id: userId } as any);
  const shareSlug = await ensureShareSlug(collection, userId, (savedDoc as ProfileDoc | null)?.shareSlug);

  let resumeFileId = savedDoc?.resumeFileId;
  let resumeFileName = savedDoc?.resumeFileName;
  if (pdfBytes) {
    resumeFileId = await saveResumePdf({
      userId,
      shareSlug,
      fileName: file.name,
      bytes: pdfBytes,
    });
    resumeFileName = file.name;
    await collection.updateOne(
      { _id: userId } as any,
      { $set: { resumeFileId, resumeFileName, updatedAt: new Date() } },
    );
  }

  const hasPdf = Boolean(resumeFileId);
  return c.json({
    profile: savedDoc
      ? {
          ...savedDoc,
          shareSlug,
          resumeFileId,
          resumeFileName,
          hasPdf,
          resumeUrl: publicResumeUrl(shareSlug),
          pdfUrl: hasPdf ? publicResumePdfUrl(c, shareSlug) : null,
        }
      : savedDoc,
  });
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

// POST /api/profile/outreach — draft a DM from resume + job post
profile.post("/outreach", async (c) => {
  const userId = c.get("userId") as string | null;
  if (!userId) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const collection = await getCollection();
  if (!collection) {
    return c.json({ error: "Profile service unavailable" }, 503);
  }

  const userDoc = await collection.findOne({ _id: userId } as any);
  if (!userDoc || !profileHasOutreachContext(userDoc as OutreachProfile)) {
    return c.json({ error: "Upload a resume first so we can draft from your profile." }, 404);
  }

  let body: { jobId?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const jobId = typeof body.jobId === "number" ? body.jobId : Number(body.jobId);
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return c.json({ error: "jobId is required" }, 400);
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { recruiter: { select: { linkedinUrl: true } } },
  });
  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  const authorProfileUrl = job.recruiter.linkedinUrl;
  const shareSlug = await ensureShareSlug(collection, userId, (userDoc as ProfileDoc).shareSlug);
  const resumeUrl = publicResumeUrl(shareSlug);
  const draft = await generateOutreachDraft(userDoc as OutreachProfile, {
    title: job.title,
    company: job.company,
    author: job.author,
    authorTitle: job.authorTitle,
    source: job.source,
    sourceUrl: job.sourceUrl,
    authorProfileUrl,
    roleFamily: job.roleFamily,
    seniority: job.seniority,
    remoteMode: job.remoteMode,
    stack: job.stack,
    description: job.description,
    rawText: job.rawText,
  }, resumeUrl);

  return c.json({
    message: draft.message,
    connectNote: draft.connectNote,
    options: draft.options,
    resumeUrl,
    authorName: job.author,
    authorTitle: job.authorTitle,
    source: job.source,
    sourceUrl: job.sourceUrl,
    openUrl: resolveOpenUrl({
      title: job.title,
      company: job.company,
      author: job.author,
      authorTitle: job.authorTitle,
      source: job.source,
      sourceUrl: job.sourceUrl,
      authorProfileUrl,
      roleFamily: job.roleFamily,
      seniority: job.seniority,
      remoteMode: job.remoteMode,
      stack: job.stack,
      description: job.description,
    }),
  });
});

export default profile;
