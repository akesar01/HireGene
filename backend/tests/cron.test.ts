import { describe, expect, it } from "vitest";
import app from "../src/index";

describe("GET /api/cron/scrape", () => {
  it("rejects missing auth", async () => {
    const res = await app.request("/api/cron/scrape");
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("rejects an invalid bearer token", async () => {
    const res = await app.request("/api/cron/scrape", {
      headers: { Authorization: "Bearer not-a-real-secret" },
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/cron/scrape", () => {
  it("rejects missing auth", async () => {
    const res = await app.request("/api/cron/scrape", { method: "POST" });
    expect(res.status).toBe(401);
  });
});
