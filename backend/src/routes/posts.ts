import { Hono } from "hono";
import { prisma } from "../lib/prisma.js";

const posts = new Hono();

// Auth middleware — require API_KEY for read endpoints
// Vote endpoint is public (no API key needed)
posts.use("/recent", async (c, next) => {
  const apiKey = c.req.header("x-api-key");
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

// Map hyphenated frontend values to DB enum values
function mapToEnum(value: string): string {
  const special: Record<string, string> = {
    "next.js": "nextjs",
    "node.js": "nodejs",
  };
  if (special[value]) return special[value];
  return value.replace(/-/g, "_");
}

// GET /api/posts/recent — filtered + sorted feed
posts.get("/recent", async (c) => {
  const sort = c.req.query("sort") ?? "new";
  const roleFamily = c.req.query("role_family");
  const seniority = c.req.query("seniority");
  const remoteMode = c.req.query("remote_mode");
  const stack = c.req.query("stack");
  const source = c.req.query("source");
  const company = c.req.query("company");

  const where = {
    // TODO: Re-enable 30-day expiry filter once we have fresh posts
    // expiresAt: { gt: new Date() },
    ...(roleFamily ? { roleFamily: mapToEnum(roleFamily) as never } : {}),
    ...(seniority ? { seniority: mapToEnum(seniority) as never } : {}),
    ...(remoteMode ? { remoteMode: mapToEnum(remoteMode) as never } : {}),
    ...(stack ? { stack: { has: mapToEnum(stack) as never } } : {}),
    ...(source ? { source: mapToEnum(source) as never } : {}),
    ...(company ? { company: { contains: company, mode: "insensitive" as const } } : {}),
  };

  const orderBy =
    sort === "top" ? [{ score: "desc" as const }] : sort === "hot" ? [{ score: "desc" as const }, { postedAt: "desc" as const }] : [{ postedAt: "desc" as const }];

  const jobs = await prisma.job.findMany({
    where,
    orderBy,
  });

  return c.json({
    jobs: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      author: job.author,
      authorTitle: job.authorTitle,
      authorAvatar: job.authorAvatar,
      roleBadge: job.roleBadge,
      source: job.source,
      sourceUrl: job.sourceUrl,
      roleFamily: job.roleFamily,
      seniority: job.seniority,
      remoteMode: job.remoteMode,
      stack: job.stack,
      description: job.description,
      comments: job.commentCount,
      score: job.score,
      postedAt: job.postedAt.toISOString(),
    })),
    count: jobs.length,
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

export default posts;
