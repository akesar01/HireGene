import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/index";
import { JOB_EXPIRY_DAYS } from "../src/lib/config";
import {
  activeJobWhere,
  computeExpiresAt,
  expiredJobWhere,
  jobExpiryCutoff,
  MS_PER_DAY,
} from "../src/lib/job-expiry";
import { prisma } from "../src/lib/prisma";

const RUN_ID = `expiry-test-${Date.now()}`;
const COMPANY = `HireGeneExpiryTest-${RUN_ID}`;
const API_KEY = process.env.API_KEY;

function daysAgo(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * MS_PER_DAY);
}

async function createJob(opts: {
  suffix: string;
  postedAt: Date;
  title: string;
  recruiterId: number;
}) {
  return prisma.job.create({
    data: {
      recruiterId: opts.recruiterId,
      title: opts.title,
      company: COMPANY,
      author: "Expiry Tester",
      authorTitle: "Test Recruiter",
      roleBadge: `${opts.title} @ ${COMPANY}`,
      source: "linkedin",
      sourceUrl: `https://expiry-test.invalid/${RUN_ID}/${opts.suffix}`,
      roleFamily: "engineering",
      seniority: "mid",
      remoteMode: "remote",
      stack: ["typescript"],
      description: ["isolated expiry fixture"],
      rawText: `expiry fixture ${opts.suffix}`,
      contentHash: `${RUN_ID}-${opts.suffix}`,
      postedAt: opts.postedAt,
      expiresAt: computeExpiresAt(opts.postedAt),
    },
  });
}

describe.skipIf(!process.env.DATABASE_URL)("job expiry against the live database", () => {
  let recruiterId: number;
  let freshJobId: number;
  let boundaryJobId: number;
  let staleJobId: number;
  let liveExpiredCount = 0;
  let liveActiveCount = 0;

  beforeAll(async () => {
    const now = new Date();
    [liveExpiredCount, liveActiveCount] = await Promise.all([
      prisma.job.count({ where: expiredJobWhere(now) }),
      prisma.job.count({ where: activeJobWhere(now) }),
    ]);

    const recruiter = await prisma.recruiter.create({
      data: {
        name: `Expiry Tester ${RUN_ID}`,
        linkedinUrl: `https://linkedin.com/in/${RUN_ID}`,
        active: false,
      },
    });
    recruiterId = recruiter.id;

    const [fresh, boundary, stale] = await Promise.all([
      createJob({
        suffix: "fresh",
        postedAt: daysAgo(5),
        title: "Fresh Expiry Fixture",
        recruiterId,
      }),
      createJob({
        suffix: "boundary",
        postedAt: jobExpiryCutoff(),
        title: "Boundary Expiry Fixture",
        recruiterId,
      }),
      createJob({
        suffix: "stale",
        postedAt: daysAgo(JOB_EXPIRY_DAYS + 10),
        title: "Stale Expiry Fixture",
        recruiterId,
      }),
    ]);

    freshJobId = fresh.id;
    boundaryJobId = boundary.id;
    staleJobId = stale.id;
  });

  afterAll(async () => {
    await prisma.job.deleteMany({
      where: { sourceUrl: { startsWith: `https://expiry-test.invalid/${RUN_ID}` } },
    });
    if (recruiterId) {
      await prisma.recruiter.deleteMany({ where: { id: recruiterId } });
    }
    await prisma.$disconnect();
  });

  it("classifies the live inventory into active vs expired", () => {
    expect(liveExpiredCount + liveActiveCount).toBeGreaterThan(0);
    console.log(
      `[expiry] live jobs: ${liveActiveCount} active, ${liveExpiredCount} older than ${JOB_EXPIRY_DAYS} days`,
    );
  });

  it("feed returns the 5-day-old job and hides 30+ day fixtures", async () => {
    expect(API_KEY).toBeTruthy();

    const res = await app.request(
      `/api/posts/recent?company=${encodeURIComponent(COMPANY)}`,
      { headers: { "x-api-key": API_KEY as string } },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { jobs: Array<{ id: number; title: string }> };
    const ids = body.jobs.map((job) => job.id);

    expect(ids).toContain(freshJobId);
    expect(ids).not.toContain(boundaryJobId);
    expect(ids).not.toContain(staleJobId);
    expect(body.jobs.every((job) => job.title === "Fresh Expiry Fixture")).toBe(true);
  });

  it("targeted purge deletes only expired fixtures, not the fresh job", async () => {
    const deleted = await prisma.job.deleteMany({
      where: {
        AND: [
          expiredJobWhere(),
          { sourceUrl: { startsWith: `https://expiry-test.invalid/${RUN_ID}` } },
        ],
      },
    });

    expect(deleted.count).toBe(2);

    const remaining = await prisma.job.findMany({
      where: { sourceUrl: { startsWith: `https://expiry-test.invalid/${RUN_ID}` } },
      select: { id: true },
    });

    expect(remaining.map((job) => job.id)).toEqual([freshJobId]);
  });

  it("admin expire endpoint rejects unauthenticated callers", async () => {
    const res = await app.request("/api/admin/jobs?mode=expired", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  it("cron expire endpoint is mounted and protected", async () => {
    const res = await app.request("/api/cron/expire-jobs");
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});
