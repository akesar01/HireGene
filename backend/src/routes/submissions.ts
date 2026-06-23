import { Hono } from "hono";
import { prisma } from "../lib/prisma.js";

const submissions = new Hono();

// POST /api/recruiter-suggest — public endpoint for community submissions
submissions.post("/recruiter-suggest", async (c) => {
  const body = await c.req.json<{
    name: string;
    linkedinUrl: string;
    company?: string;
    title?: string;
    note?: string;
  }>();

  if (!body.name || !body.linkedinUrl) {
    return c.json({ error: "name and linkedinUrl are required" }, 400);
  }

  // Validate LinkedIn URL
  if (!body.linkedinUrl.includes("linkedin.com/")) {
    return c.json({ error: "URL must be a LinkedIn profile URL" }, 400);
  }

  // Check if already an approved recruiter
  const existingRecruiter = await prisma.recruiter.findUnique({
    where: { linkedinUrl: body.linkedinUrl },
  });
  if (existingRecruiter) {
    return c.json({ error: "This hiring manager is already being tracked" }, 409);
  }

  // Check if there's already a pending submission for this URL
  const existingSubmission = await prisma.recruiterSubmission.findFirst({
    where: { linkedinUrl: body.linkedinUrl, status: "pending" },
  });
  if (existingSubmission) {
    return c.json({ error: "This hiring manager is already pending review" }, 409);
  }

  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? null;

  const submission = await prisma.recruiterSubmission.create({
    data: {
      name: body.name,
      linkedinUrl: body.linkedinUrl,
      company: body.company ?? null,
      title: body.title ?? null,
      note: body.note ?? null,
      submittedByIp: ip,
    },
  });

  return c.json({
    id: submission.id,
    status: submission.status,
    message: "Submission received. Our team will review before adding to the tracking list.",
  }, 201);
});

export default submissions;
