import { describe, expect, it } from "vitest";
import {
  DEFAULT_APIFY_MAX_CONCURRENT,
  isApifyConcurrentLimitError,
  maxConcurrentApifyRuns,
  remainingApifyStartSlots,
} from "../src/lib/apify-limits";

describe("remainingApifyStartSlots", () => {
  it("caps new starts at Apify's 5 concurrent runs", () => {
    expect(remainingApifyStartSlots(0, 5)).toBe(5);
    expect(remainingApifyStartSlots(5, 5)).toBe(0);
    expect(remainingApifyStartSlots(7, 5)).toBe(0);
  });

  it("counts currently open runs against the cap", () => {
    expect(remainingApifyStartSlots(3, 5)).toBe(2);
  });
});

describe("maxConcurrentApifyRuns", () => {
  it("defaults to 5", () => {
    expect(maxConcurrentApifyRuns({})).toBe(DEFAULT_APIFY_MAX_CONCURRENT);
  });

  it("reads APIFY_MAX_CONCURRENT when it is a positive integer", () => {
    expect(maxConcurrentApifyRuns({ APIFY_MAX_CONCURRENT: "3" })).toBe(3);
    expect(maxConcurrentApifyRuns({ APIFY_MAX_CONCURRENT: "0" })).toBe(5);
    expect(maxConcurrentApifyRuns({ APIFY_MAX_CONCURRENT: "nope" })).toBe(5);
  });
});

describe("isApifyConcurrentLimitError", () => {
  it("detects Apify's 402 concurrent-runs-limit-exceeded body", () => {
    const body =
      '{"error":{"type":"concurrent-runs-limit-exceeded","message":"By launching this job you will exceed your limit of 5 concurrent Actor runs."}}';
    expect(isApifyConcurrentLimitError(402, body)).toBe(true);
    expect(isApifyConcurrentLimitError(402, '{"error":"payment required"}')).toBe(false);
    expect(isApifyConcurrentLimitError(429, body)).toBe(false);
  });
});
