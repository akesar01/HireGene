import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.API_KEY = "test-api-key";
  process.env.CLERK_SECRET_KEY = "sk_test_fake";
  delete process.env.CORS_ORIGIN;
});

const { findUnique, findMany } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(async () => [] as unknown[]),
}));

vi.mock("../src/lib/prisma", () => ({ prisma: { job: { findUnique, findMany } } }));
vi.mock("@clerk/backend", () => ({ verifyToken: vi.fn(async () => ({ sub: "user_123" })) }));
vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));

import app from "../src/index";
import { JOB_DETAIL_CACHE_CONTROL } from "../src/routes/posts";

const DAY = 86_400_000;

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    title: "Senior Backend Engineer",
    company: "Razorpay",
    author: "Harish Kumar",
    authorTitle: "VP Engineering @ Razorpay",
    authorAvatar: null,
    roleBadge: "Senior Backend Engineer @ Razorpay",
    source: "linkedin",
    sourceUrl: "https://linkedin.com/posts/example",
    roleFamily: "engineering",
    seniority: "senior",
    remoteMode: "in_office",
    stack: ["go"],
    description: ["5+ years building payment systems"],
    rawText: "We're hiring in Bangalore. Full-time. DM me.",
    commentCount: 0,
    score: 3,
    postedAt: new Date(Date.now() - 2 * DAY),
    createdAt: new Date(Date.now() - 2 * DAY),
    recruiter: { linkedinUrl: "https://linkedin.com/in/harish" },
    ...overrides,
  };
}

const headers = { "x-api-key": "test-api-key" };

describe("GET /api/posts/:id", () => {
  beforeEach(() => findUnique.mockReset());

  it("requires the API key", async () => {
    const res = await app.request("/api/posts/42");
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns the job with facts derived from its text, cached at the CDN", async () => {
    findUnique.mockResolvedValue(row());
    const res = await app.request("/api/posts/42", { headers });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(JOB_DETAIL_CACHE_CONTROL);
    const { job } = (await res.json()) as { job: Record<string, unknown> };
    expect(job).toMatchObject({
      id: 42,
      company: "Razorpay",
      locations: [{ city: "Bengaluru", region: "Karnataka", country: "IN" }],
      country: "IN",
      employmentTypes: ["FULL_TIME"],
      posterKind: "Hiring manager",
      levelLabel: "Senior / SDE-3+",
      remoteLabel: "In-office",
      expired: false,
    });
    expect(job).not.toHaveProperty("rawText");
  });

  it("flags a job past its expiry window", async () => {
    findUnique.mockResolvedValue(row({ postedAt: new Date(Date.now() - 31 * DAY) }));
    const res = await app.request("/api/posts/42", { headers });
    const { job } = (await res.json()) as { job: { expired: boolean } };
    expect(job.expired).toBe(true);
  });

  it("answers 404 for a missing job", async () => {
    findUnique.mockResolvedValue(null);
    const res = await app.request("/api/posts/999", { headers });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/posts/recent", () => {
  it("includes the cities each post names", async () => {
    findMany.mockResolvedValueOnce([row()]);
    const res = await app.request("/api/posts/recent?sort=new", { headers });
    const { jobs } = (await res.json()) as { jobs: { locations: { city: string }[] }[] };
    expect(jobs[0].locations.map((l) => l.city)).toEqual(["Bengaluru"]);
  });
});
