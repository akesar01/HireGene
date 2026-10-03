import { describe, expect, it } from "vitest";
import { computeTagOverlapScore, isAdjacentSeniority } from "../src/lib/match-score";
import { computeTagOverlapScore as siteScore } from "../../frontend/src/lib/match";

type SiteJob = Parameters<typeof siteScore>[0];
type SiteProfile = Parameters<typeof siteScore>[1];

const profile = { roleFamily: "engineering", seniority: "junior", remoteMode: "in_office", stack: ["java", "python", "sql", "aws"] };

describe("computeTagOverlapScore", () => {
  it("scores a full match 100 and weights stack 40 / role 30 / seniority 20 / remote 10", () => {
    expect(computeTagOverlapScore({ roleFamily: "engineering", seniority: "junior", remoteMode: "in_office", stack: ["java", "python", "sql", "aws"] }, profile)).toBe(100);
    expect(computeTagOverlapScore({ roleFamily: "engineering", seniority: "junior", remoteMode: "in_office", stack: ["python", "nodejs", "java"] }, profile)).toBe(80);
    expect(computeTagOverlapScore({ roleFamily: "product", seniority: "junior", remoteMode: "in_office", stack: ["java", "python", "sql", "aws"] }, profile)).toBe(70);
  });

  it("gives adjacent seniority half credit", () => {
    expect(isAdjacentSeniority("junior", "mid")).toBe(true);
    expect(isAdjacentSeniority("junior", "senior")).toBe(false);
    expect(computeTagOverlapScore({ roleFamily: "engineering", seniority: "mid", remoteMode: "in_office", stack: ["java", "python", "sql", "aws"] }, profile)).toBe(90);
    expect(computeTagOverlapScore({ roleFamily: "engineering", seniority: "senior", remoteMode: "in_office", stack: ["java", "python", "sql", "aws"] }, profile)).toBe(80);
  });

  it("treats a job with no stack tags as neutral, not as a zero", () => {
    const noStack = computeTagOverlapScore({ roleFamily: "engineering", seniority: "junior", remoteMode: "in_office", stack: [] }, profile);
    const halfOverlap = computeTagOverlapScore({ roleFamily: "engineering", seniority: "junior", remoteMode: "in_office", stack: ["java", "python", "nodejs", "go"] }, profile);
    const noOverlap = computeTagOverlapScore({ roleFamily: "engineering", seniority: "junior", remoteMode: "in_office", stack: ["go"] }, profile);
    expect(noStack).toBe(80);
    expect(noStack).toBe(halfOverlap);
    expect(noStack).toBeGreaterThan(noOverlap);
  });

  it("agrees with the site for a profile with no stack: the job's stack still counts against it", () => {
    const noStackProfile = { roleFamily: "engineering", seniority: "junior", remoteMode: "in_office", stack: [] };
    const goJob = { roleFamily: "engineering", seniority: "junior", remoteMode: "in_office", stack: ["go"] };
    const noStackJob = { ...goJob, stack: [] };
    expect(computeTagOverlapScore(goJob, noStackProfile)).toBe(60);
    expect(computeTagOverlapScore(goJob, noStackProfile)).toBe(siteScore(goJob as SiteJob, noStackProfile as SiteProfile));
    expect(computeTagOverlapScore(noStackJob, noStackProfile)).toBe(100);
    expect(computeTagOverlapScore(noStackJob, noStackProfile)).toBe(siteScore(noStackJob as SiteJob, noStackProfile as SiteProfile));
  });

  it("agrees with the site whenever the job lists a stack; only the no-stack job differs by design", () => {
    const jobs = [
      { roleFamily: "engineering", seniority: "junior", remoteMode: "in_office", stack: ["java", "python", "sql", "aws"] },
      { roleFamily: "engineering", seniority: "mid", remoteMode: "remote", stack: ["python", "nodejs", "java"] },
      { roleFamily: "product", seniority: "senior", remoteMode: "hybrid", stack: ["go"] },
    ];
    for (const job of jobs) {
      expect(computeTagOverlapScore(job, profile)).toBe(siteScore(job as SiteJob, profile as SiteProfile));
    }
    const noStackJob = { roleFamily: "engineering", seniority: "junior", remoteMode: "in_office", stack: [] };
    expect(siteScore(noStackJob as SiteJob, profile as SiteProfile)).toBe(60);
    expect(computeTagOverlapScore(noStackJob, profile)).toBe(80);
  });

  it("normalises hyphenated frontend spellings against the stored enums", () => {
    expect(computeTagOverlapScore({ roleFamily: "ai-ml", seniority: "junior", remoteMode: "in-office", stack: ["nextjs"] }, { roleFamily: "ai_ml", seniority: "junior", remoteMode: "in_office", stack: ["nextjs"] })).toBe(100);
  });

  it("returns 0 when the profile has nothing to match on", () => {
    expect(computeTagOverlapScore({ roleFamily: "engineering", seniority: "junior", remoteMode: "remote", stack: [] }, { roleFamily: "", seniority: "", remoteMode: "", stack: [] })).toBe(0);
  });
});
