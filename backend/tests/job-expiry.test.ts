import { describe, expect, it } from "vitest";
import { JOB_EXPIRY_DAYS } from "../src/lib/config";
import {
  activeJobWhere,
  computeExpiresAt,
  expiredJobWhere,
  isJobExpired,
  jobExpiryCutoff,
} from "../src/lib/job-expiry";

describe("job expiry", () => {
  const now = new Date("2026-08-15T12:00:00.000Z");

  it(`cutoff is exactly ${JOB_EXPIRY_DAYS} days before now`, () => {
    const cutoff = jobExpiryCutoff(now);
    expect(cutoff.toISOString()).toBe("2026-07-16T12:00:00.000Z");
  });

  it(`expiresAt is postedAt plus ${JOB_EXPIRY_DAYS} days`, () => {
    const postedAt = new Date("2026-07-20T08:00:00.000Z");
    expect(computeExpiresAt(postedAt).toISOString()).toBe("2026-08-19T08:00:00.000Z");
  });

  it("treats a job posted exactly at the cutoff as expired", () => {
    expect(isJobExpired(jobExpiryCutoff(now), now)).toBe(true);
  });

  it("treats a job newer than the cutoff as active", () => {
    const postedAt = new Date("2026-07-16T12:00:00.001Z");
    expect(isJobExpired(postedAt, now)).toBe(false);
  });

  it("treats a job older than the cutoff as expired", () => {
    const postedAt = new Date("2026-07-16T11:59:59.999Z");
    expect(isJobExpired(postedAt, now)).toBe(true);
  });

  it("active where clause keeps jobs newer than the cutoff", () => {
    expect(activeJobWhere(now)).toEqual({
      postedAt: { gt: jobExpiryCutoff(now) },
    });
  });

  it("expired where clause deletes jobs at or older than the cutoff", () => {
    expect(expiredJobWhere(now)).toEqual({
      postedAt: { lte: jobExpiryCutoff(now) },
    });
  });
});
