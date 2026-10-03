import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.CLERK_SECRET_KEY = "sk_test_fake";
  process.env.ADMIN_SECRET = "machine-admin-secret";
  process.env.ADMIN_USER_IDS = "user_admin_by_id";
  process.env.ADMIN_EMAILS = "Captain@Example.com";
});

vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(async (token: string) => {
    if (token.startsWith("clerk:")) return { sub: token.slice("clerk:".length) };
    throw new Error("invalid token");
  }),
  createClerkClient: vi.fn(),
}));
vi.mock("../src/lib/clerk-users", () => ({
  fetchClerkUsers: vi.fn(async (ids: string[]) => {
    const emails: Record<string, string> = { user_captain: "captain@example.com", user_nobody: "nobody@example.com" };
    return new Map(ids.filter((id) => emails[id]).map((id) => [id, { userId: id, email: emails[id], firstName: null }]));
  }),
}));
vi.mock("../src/lib/prisma", async () => {
  const { createFakePrisma } = await import("./helpers/fake-prisma");
  return { prisma: createFakePrisma() };
});
vi.mock("../src/lib/mongo", () => ({ getProfilesCollection: async () => null, getDb: async () => null }));

import app from "../src/index";
import { decideAdminAuth } from "../src/lib/admin-auth";

const ADMIN_PATHS = ["/api/admin/whoami", "/api/admin/stats/subscribers", "/api/admin/nudges/schedule", "/api/admin/recruiters"];

describe("admin auth", () => {
  it("rejects anonymous requests with 401 on every admin path", async () => {
    for (const path of ADMIN_PATHS) {
      const res = await app.request(path);
      expect(res.status, path).toBe(401);
    }
  });

  it("rejects a signed-in non-admin with 403", async () => {
    for (const path of ADMIN_PATHS) {
      const res = await app.request(path, { headers: { Authorization: "Bearer clerk:user_nobody" } });
      expect(res.status, path).toBe(403);
      await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
    }
  });

  it("rejects an invalid Clerk token as anonymous", async () => {
    const res = await app.request("/api/admin/whoami", { headers: { Authorization: "Bearer garbage" } });
    expect(res.status).toBe(401);
  });

  it("allows an admin listed by Clerk user id", async () => {
    const res = await app.request("/api/admin/whoami", { headers: { Authorization: "Bearer clerk:user_admin_by_id" } });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, via: "clerk", userId: "user_admin_by_id" });
  });

  it("allows an admin listed by primary Clerk email (case-insensitive)", async () => {
    const res = await app.request("/api/admin/whoami", { headers: { Authorization: "Bearer clerk:user_captain" } });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, via: "clerk", userId: "user_captain" });
  });

  it("still accepts the machine ADMIN_SECRET for scripts", async () => {
    const res = await app.request("/api/admin/whoami", { headers: { Authorization: "Bearer machine-admin-secret" } });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, via: "secret" });
  });

  it("does not consult Clerk for emails when ADMIN_EMAILS is empty", async () => {
    const resolveEmail = vi.fn(async () => "captain@example.com");
    const decision = await decideAdminAuth({
      authHeader: undefined,
      userId: "user_captain",
      env: { ADMIN_USER_IDS: "" } as NodeJS.ProcessEnv,
      resolveEmail,
    });
    expect(decision).toEqual({ ok: false, status: 403, error: "Forbidden" });
    expect(resolveEmail).not.toHaveBeenCalled();
  });

  it("treats an email lookup failure as not-admin", async () => {
    const decision = await decideAdminAuth({
      authHeader: undefined,
      userId: "user_x",
      env: { ADMIN_EMAILS: "captain@example.com" } as NodeJS.ProcessEnv,
      resolveEmail: async () => {
        throw new Error("clerk down");
      },
    });
    expect(decision).toEqual({ ok: false, status: 403, error: "Forbidden" });
  });
});
