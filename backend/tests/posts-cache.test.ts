import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.API_KEY = "test-api-key";
  process.env.CLERK_SECRET_KEY = "sk_test_fake";
  delete process.env.CORS_ORIGIN;
});

vi.mock("../src/lib/prisma", () => ({
  prisma: { job: { findMany: vi.fn(async () => []) } },
}));
vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(async (token: string) => {
    if (token === "valid-user-token") return { sub: "user_123" };
    throw new Error("invalid token");
  }),
}));
vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));

import app from "../src/index";
import { ANONYMOUS_FEED_CACHE_CONTROL } from "../src/routes/posts";

const feed = "/api/posts/recent?sort=new";

describe("GET /api/posts/recent cache headers", () => {
  it("lets the CDN share the anonymous feed for 60s", async () => {
    const res = await app.request(feed, { headers: { "x-api-key": "test-api-key" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(ANONYMOUS_FEED_CACHE_CONTROL);
    expect(ANONYMOUS_FEED_CACHE_CONTROL).toContain("s-maxage=60");
    expect(ANONYMOUS_FEED_CACHE_CONTROL).toContain("stale-while-revalidate");
    expect(res.headers.get("Vary")?.toLowerCase()).toContain("x-api-key");
  });

  it("never caches a signed-in user's feed", async () => {
    const res = await app.request(`${feed}&applied_only=true`, {
      headers: { "x-api-key": "test-api-key", Authorization: "Bearer valid-user-token" },
    });
    expect(res.status).toBe(200);
    const cacheControl = res.headers.get("Cache-Control") ?? "";
    expect(cacheControl).toContain("private");
    expect(cacheControl).toContain("no-store");
    expect(cacheControl).not.toContain("s-maxage");
  });

  it("does not cache a request whose bearer token fails verification", async () => {
    const res = await app.request(feed, {
      headers: { "x-api-key": "test-api-key", Authorization: "Bearer bad-token" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("does not mark the 401 for a missing API key as cacheable", async () => {
    const res = await app.request(feed);
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control") ?? "").not.toContain("s-maxage");
  });
});
