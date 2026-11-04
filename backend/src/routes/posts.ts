import { Hono, type Context, type Next } from "hono";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { activeJobWhere, computeExpiresAt, isJobExpired } from "../lib/job-expiry.js";
import { jobFacts } from "../lib/job-facts.js";
import { effectiveSeniority, levelLabel, posterKind, remoteLabel } from "../lib/nudge-select.js";

type Variables = {
  userId: string | null;
};

const posts = new Hono<{ Variables: Variables }>();

export const ANONYMOUS_FEED_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";
/** One job's public page data; the same for every caller. */
export const JOB_DETAIL_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

// Auth middleware — require API_KEY for read endpoints
// Vote endpoint is public (no API key needed)
const requireApiKey = async (c: Context, next: Next) => {
  const apiKey = c.req.header("x-api-key");
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
};
posts.use("/recent", requireApiKey);
posts.use("/:id{[0-9]+}", requireApiKey);

type FeedJobRow = Prisma.JobGetPayload<{ include: { recruiter: { select: { linkedinUrl: true } } } }>;

/** The feed's view of a job; also the base of the single-job response. */
function feedJob(job: FeedJobRow) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    author: job.author,
    authorTitle: job.authorTitle,
    authorAvatar: job.authorAvatar,
    authorProfileUrl: job.recruiter.linkedinUrl,
    roleBadge: job.roleBadge,
    source: job.source,
    sourceUrl: job.sourceUrl,
    roleFamily: job.roleFamily,
    seniority: job.seniority,
    remoteMode: job.remoteMode,
    stack: job.stack,
    description: job.description,
    // Cities named in the post; the frontend puts the first one in the job URL.
    locations: jobFacts(job).locations,
    comments: job.commentCount,
    score: job.score,
    postedAt: job.postedAt.toISOString(),
    createdAt: job.createdAt.toISOString(),
  };
}

// Map hyphenated frontend values to DB enum values
function mapToEnum(value: string): string {
  const special: Record<string, string> = {
    "next.js": "nextjs",
    "node.js": "nodejs",
  };
  if (special[value]) return special[value];
  return value.replace(/-/g, "_");
}

// GET /api/posts/applied — get job IDs the current user has applied to (auth required)
posts.get("/applied", async (c) => {
  const userId = c.get("userId") as string | null;
  if (!userId) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const applications = await prisma.jobApplication.findMany({
    where: { userId },
    select: { jobId: true },
  });

  return c.json({ jobIds: applications.map((a) => a.jobId) });
});

// GET /api/posts/recent — filtered + sorted feed
posts.get("/recent", async (c) => {
  const sort = c.req.query("sort") ?? "new";
  const roleFamily = c.req.query("role_family");
  const seniority = c.req.query("seniority");
  const remoteMode = c.req.query("remote_mode");
  const stack = c.req.query("stack");
  const source = c.req.query("source");
  const company = c.req.query("company");
  const appliedOnly = c.req.query("applied_only") === "true";
  const userId = c.get("userId") as string | null;

  const where = {
    ...activeJobWhere(),
    ...(roleFamily ? { roleFamily: mapToEnum(roleFamily) as never } : {}),
    ...(seniority ? { seniority: mapToEnum(seniority) as never } : {}),
    ...(remoteMode ? { remoteMode: mapToEnum(remoteMode) as never } : {}),
    ...(stack ? { stack: { has: mapToEnum(stack) as never } } : {}),
    ...(source ? { source: mapToEnum(source) as never } : {}),
    ...(company ? { company: { contains: company, mode: "insensitive" as const } } : {}),
    ...(appliedOnly && userId ? { applications: { some: { userId } } } : {}),
  };

  const orderBy =
    sort === "top"
      ? [{ score: "desc" as const }, { postedAt: "desc" as const }]
      : [{ postedAt: "desc" as const }];

  const jobs = await prisma.job.findMany({
    where,
    orderBy,
    include: { recruiter: { select: { linkedinUrl: true } } },
  });

  // Anonymous feeds are identical for everyone, so let the CDN share them for
  // 60s. Vercel's CDN never caches requests that carry an Authorization header,
  // and anything sent with one is marked private here as well.
  if (c.req.header("Authorization")) {
    c.header("Cache-Control", "private, no-store");
  } else {
    c.header("Cache-Control", ANONYMOUS_FEED_CACHE_CONTROL);
    // Key cached entries by API key so the CDN never answers a keyless request.
    c.header("Vary", "x-api-key", { append: true });
  }

  return c.json({
    jobs: jobs.map(feedJob),
    count: jobs.length,
  });
});

// Job.id is a Postgres Int4; larger ids cannot exist and Prisma rejects them.
const MAX_JOB_ID = 2_147_483_647;

// GET /api/posts/:id — one job for its public page. Expired jobs that are not
// purged yet still answer, flagged expired, so the page can drop them from search.
posts.get("/:id{[0-9]+}", async (c) => {
  const id = Number(c.req.param("id"));
  const job =
    id <= MAX_JOB_ID
      ? await prisma.job.findUnique({
          where: { id },
          include: { recruiter: { select: { linkedinUrl: true } } },
        })
      : null;
  if (!job) {
    c.header("Cache-Control", "public, s-maxage=60");
    return c.json({ error: "Job not found" }, 404);
  }

  const facts = jobFacts(job);
  const seniority = effectiveSeniority(job);
  c.header("Cache-Control", JOB_DETAIL_CACHE_CONTROL);
  c.header("Vary", "x-api-key", { append: true });
  return c.json({
    job: {
      ...feedJob(job),
      country: facts.country,
      employmentTypes: facts.employmentTypes,
      posterKind: posterKind(job.authorTitle),
      levelLabel: levelLabel(seniority),
      remoteLabel: remoteLabel(job.remoteMode),
      expiresAt: computeExpiresAt(job.postedAt).toISOString(),
      expired: isJobExpired(job.postedAt),
    },
  });
});

// POST /api/posts/:id/vote — public endpoint, IP-based dedup
posts.post("/:id/vote", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) {
    return c.json({ error: "Invalid job ID" }, 400);
  }

  const { direction } = await c.req.json<{ direction: "up" | "down" }>();
  if (direction !== "up" && direction !== "down") {
    return c.json({ error: "direction must be 'up' or 'down'" }, 400);
  }

  const voterIp = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? "unknown";

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  // Check existing vote from this IP
  const existingVote = await prisma.vote.findUnique({
    where: { jobId_voterIp: { jobId: id, voterIp } },
  });

  if (existingVote) {
    if (existingVote.direction === direction) {
      // Same vote — toggle off (remove vote)
      await prisma.$transaction([
        prisma.vote.delete({ where: { id: existingVote.id } }),
        prisma.job.update({ where: { id }, data: { score: { decrement: direction === "up" ? 1 : -1 } } }),
      ]);
      const updated = await prisma.job.findUnique({ where: { id }, select: { score: true } });
      return c.json({ score: updated!.score, voted: false });
    } else {
      // Different direction — flip vote (net change of 2)
      await prisma.$transaction([
        prisma.vote.update({ where: { id: existingVote.id }, data: { direction } }),
        prisma.job.update({ where: { id }, data: { score: { increment: direction === "up" ? 2 : -2 } } }),
      ]);
      const updated = await prisma.job.findUnique({ where: { id }, select: { score: true } });
      return c.json({ score: updated!.score, voted: true, direction });
    }
  }

  // No existing vote — create new
  await prisma.$transaction([
    prisma.vote.create({ data: { jobId: id, voterIp, direction } }),
    prisma.job.update({ where: { id }, data: { score: { increment: direction === "up" ? 1 : -1 } } }),
  ]);
  const updated = await prisma.job.findUnique({ where: { id }, select: { score: true } });
  return c.json({ score: updated!.score, voted: true, direction }, 201);
});

// POST /api/posts/:id/apply — toggle applied status (auth required)
posts.post("/:id/apply", async (c) => {
  const userId = c.get("userId") as string | null;
  if (!userId) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) {
    return c.json({ error: "Invalid job ID" }, 400);
  }

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  const existing = await prisma.jobApplication.findUnique({
    where: { jobId_userId: { jobId: id, userId } },
  });

  if (existing) {
    await prisma.jobApplication.delete({ where: { id: existing.id } });
    return c.json({ applied: false });
  }

  await prisma.jobApplication.create({ data: { jobId: id, userId } });
  return c.json({ applied: true }, 201);
});

export default posts;
