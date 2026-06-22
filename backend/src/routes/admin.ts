import { Hono } from "hono";
import { prisma } from "../lib/prisma";
import { scrapeRecruiter } from "../lib/apify";
import { JOB_EXPIRY_DAYS } from "../lib/config";

const admin = new Hono();

// Auth middleware — require ADMIN_SECRET
admin.use("*", async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!auth || auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

// POST /api/admin/recruiter — add recruiter
admin.post("/recruiter", async (c) => {
  const body = await c.req.json<{
    name: string;
    linkedinUrl: string;
    scrapeIntervalHours?: number;
  }>();

  if (!body.name || !body.linkedinUrl) {
    return c.json({ error: "name and linkedinUrl are required" }, 400);
  }

  const existing = await prisma.recruiter.findUnique({
    where: { linkedinUrl: body.linkedinUrl },
  });
  if (existing) {
    return c.json({ error: "Recruiter with this LinkedIn URL already exists" }, 409);
  }

  const recruiter = await prisma.recruiter.create({
    data: {
      name: body.name,
      linkedinUrl: body.linkedinUrl,
      scrapeIntervalHours: body.scrapeIntervalHours ?? 24,
    },
  });

  return c.json({
    id: recruiter.id,
    name: recruiter.name,
    linkedinUrl: recruiter.linkedinUrl,
    active: recruiter.active,
    scrapeIntervalHours: recruiter.scrapeIntervalHours,
    addedAt: recruiter.addedAt.toISOString(),
  }, 201);
});

// GET /api/admin/recruiters — list all recruiters
admin.get("/recruiters", async (c) => {
  const recruiters = await prisma.recruiter.findMany({
    orderBy: { addedAt: "desc" },
  });

  return c.json({
    recruiters: recruiters.map((r) => ({
      id: r.id,
      name: r.name,
      linkedinUrl: r.linkedinUrl,
      active: r.active,
      scrapeIntervalHours: r.scrapeIntervalHours,
      addedAt: r.addedAt.toISOString(),
      lastScrapedAt: r.lastScrapedAt?.toISOString() ?? null,
    })),
    count: recruiters.length,
  });
});

// DELETE /api/admin/jobs — clear jobs (all, expired, or older than N days)
admin.delete("/jobs", async (c) => {
  const mode = c.req.query("mode") ?? "expired"; // expired | all | olderThan
  const olderThanDays = parseInt(c.req.query("olderThanDays") ?? String(JOB_EXPIRY_DAYS));

  let where = {};
  let description = "all jobs";

  if (mode === "expired") {
    where = { expiresAt: { lt: new Date() } };
    description = "expired jobs";
  } else if (mode === "olderThan") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    where = { postedAt: { lt: cutoff } };
    description = `jobs older than ${olderThanDays} days`;
  }

  const result = await prisma.job.deleteMany({ where });

  return c.json({
    deleted: result.count,
    mode,
    description: `Cleared ${result.count} ${description}`,
  });
});

// POST /api/admin/scrape — trigger manual scrape
admin.post("/scrape", async (c) => {
  const { recruiterId } = await c.req.json<{ recruiterId: number }>();

  if (!recruiterId) {
    return c.json({ error: "recruiterId is required" }, 400);
  }

  const recruiter = await prisma.recruiter.findUnique({
    where: { id: recruiterId },
  });
  if (!recruiter) {
    return c.json({ error: "Recruiter not found" }, 404);
  }

  try {
    const result = await scrapeRecruiter(recruiter);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Scrape failed: ${message}` }, 500);
  }
});

// GET /api/admin/submissions — list submissions (optionally filtered by status)
admin.get("/submissions", async (c) => {
  const status = c.req.query("status") ?? "pending";

  const submissions = await prisma.recruiterSubmission.findMany({
    where: { status: status as "pending" | "approved" | "rejected" },
    orderBy: { createdAt: "desc" },
  });

  return c.json({
    submissions: submissions.map((s) => ({
      id: s.id,
      name: s.name,
      linkedinUrl: s.linkedinUrl,
      company: s.company,
      title: s.title,
      note: s.note,
      status: s.status,
      recruiterId: s.recruiterId,
      submittedAt: s.createdAt.toISOString(),
      reviewedAt: s.reviewedAt?.toISOString() ?? null,
    })),
    count: submissions.length,
  });
});

// POST /api/admin/submissions/:id/approve — approve a submission, create recruiter
admin.post("/submissions/:id/approve", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) {
    return c.json({ error: "Invalid submission ID" }, 400);
  }

  const submission = await prisma.recruiterSubmission.findUnique({ where: { id } });
  if (!submission) {
    return c.json({ error: "Submission not found" }, 404);
  }
  if (submission.status !== "pending") {
    return c.json({ error: `Submission already ${submission.status}` }, 400);
  }

  // Check if recruiter already exists (edge case: approved twice)
  const existing = await prisma.recruiter.findUnique({
    where: { linkedinUrl: submission.linkedinUrl },
  });
  if (existing) {
    // Mark as approved and link
    await prisma.recruiterSubmission.update({
      where: { id },
      data: { status: "approved", reviewedAt: new Date(), recruiterId: existing.id },
    });
    return c.json({ message: "Recruiter already exists, submission marked approved", recruiterId: existing.id });
  }

  // Create recruiter and mark submission approved in a transaction
  const recruiter = await prisma.$transaction(async (tx) => {
    const r = await tx.recruiter.create({
      data: {
        name: submission.name,
        linkedinUrl: submission.linkedinUrl,
      },
    });
    await tx.recruiterSubmission.update({
      where: { id },
      data: { status: "approved", reviewedAt: new Date(), recruiterId: r.id },
    });
    return r;
  });

  return c.json({
    id: recruiter.id,
    name: recruiter.name,
    linkedinUrl: recruiter.linkedinUrl,
    active: recruiter.active,
    message: "Recruiter approved and added to tracking list",
  }, 201);
});

// POST /api/admin/submissions/:id/reject — reject a submission
admin.post("/submissions/:id/reject", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) {
    return c.json({ error: "Invalid submission ID" }, 400);
  }

  const submission = await prisma.recruiterSubmission.findUnique({ where: { id } });
  if (!submission) {
    return c.json({ error: "Submission not found" }, 404);
  }
  if (submission.status !== "pending") {
    return c.json({ error: `Submission already ${submission.status}` }, 400);
  }

  await prisma.recruiterSubmission.update({
    where: { id },
    data: { status: "rejected", reviewedAt: new Date() },
  });

  return c.json({ message: "Submission rejected" });
});

export default admin;
