import { describe, expect, it } from "vitest";
import {
  nextDelayHop,
  scrapeSelfUrl,
  SCRAPE_BATCH_GAP_MS,
  SCRAPE_DELAY_HOP_MS,
} from "../src/lib/scrape-chain";

describe("nextDelayHop", () => {
  it("splits a 10-minute gap across Hobby 300s invocations", () => {
    const hops = [];
    let remaining = SCRAPE_BATCH_GAP_MS;
    while (remaining > 0) {
      const hop = nextDelayHop(remaining);
      hops.push(hop);
      remaining = hop.leftoverMs;
    }
    expect(hops.length).toBeGreaterThanOrEqual(2);
    expect(hops.every((hop) => hop.sleepMs <= SCRAPE_DELAY_HOP_MS)).toBe(true);
    expect(hops.reduce((sum, hop) => sum + hop.sleepMs, 0)).toBe(SCRAPE_BATCH_GAP_MS);
    expect(hops.at(-1)?.leftoverMs).toBe(0);
  });

  it("does not sleep longer than the hop cap", () => {
    expect(nextDelayHop(1_000_000, 1000)).toEqual({ sleepMs: 1000, leftoverMs: 999_000 });
  });
});

describe("scrapeSelfUrl", () => {
  it("prefers an explicit URL", () => {
    expect(scrapeSelfUrl({ SCRAPE_SELF_URL: "https://example.com/api/" })).toBe(
      "https://example.com/api",
    );
  });

  it("falls back to the production alias", () => {
    expect(scrapeSelfUrl({})).toBe("https://backend-umber-nu-43.vercel.app");
  });
});
