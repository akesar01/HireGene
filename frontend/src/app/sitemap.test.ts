import { afterEach, describe, expect, it, vi } from "vitest";
import type { Job } from "@/lib/data";

const { fetchJobs } = vi.hoisted(() => ({ fetchJobs: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJobs }));

import robots from "./robots";
import sitemap from "./sitemap";

const job = (id: number, title: string, createdAt: string): Job => ({
  id,
  title,
  company: "Razorpay",
  author: "Harish Kumar",
  authorTitle: "VP Engineering",
  roleBadge: `${title} @ Razorpay`,
  source: "linkedin",
  sourceUrl: `https://linkedin.com/posts/${id}`,
  roleFamily: "engineering",
  seniority: "senior",
  remoteMode: "in-office",
  stack: [],
  description: [],
  locations: [{ city: "Pune", region: "Maharashtra", country: "IN" }],
  comments: 0,
  score: 0,
  postedAt: createdAt,
  createdAt,
});

describe("sitemap.xml", () => {
  afterEach(() => fetchJobs.mockReset());

  it("lists every live job URL with its lastmod", async () => {
    fetchJobs.mockResolvedValue([
      job(1, "Backend Engineer", "2026-11-03T08:00:00.000Z"),
      job(2, "SRE", "2026-11-02T08:00:00.000Z"),
    ]);
    const entries = await sitemap();
    const jobs = entries.filter((e) => e.url.includes("/jobs/"));
    expect(jobs.map((e) => e.url)).toEqual([
      "https://skiptheboard.in/jobs/backend-engineer-razorpay-pune-1",
      "https://skiptheboard.in/jobs/sre-razorpay-pune-2",
    ]);
    expect(jobs[0].lastModified).toEqual(new Date("2026-11-03T08:00:00.000Z"));
    expect(entries.map((e) => e.url)).toContain("https://skiptheboard.in");
  });

  it("still serves the static pages when the backend is down", async () => {
    fetchJobs.mockRejectedValue(new Error("down"));
    const entries = await sitemap();
    expect(entries.some((e) => e.url.includes("/jobs/"))).toBe(false);
    expect(entries.map((e) => e.url)).toContain("https://skiptheboard.in/about");
  });
});

describe("robots.txt", () => {
  it("allows job pages and points at the sitemap", () => {
    const rules = robots();
    const rule = Array.isArray(rules.rules) ? rules.rules[0] : rules.rules;
    expect(rule.allow).toContain("/jobs/");
    expect(rule.disallow).not.toContain("/jobs/");
    expect(rules.sitemap).toBe("https://skiptheboard.in/sitemap.xml");
  });
});
