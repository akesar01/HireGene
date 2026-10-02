import { beforeEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "svix";

const { WEBHOOK_SECRET } = vi.hoisted(() => {
  const WEBHOOK_SECRET = `whsec_${Buffer.from("test-webhook-secret-bytes").toString("base64")}`;
  process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.UNSUBSCRIBE_SECRET = "unsub-secret";
  process.env.FRONTEND_URL = "https://skiptheboard.in";
  return { WEBHOOK_SECRET };
});

vi.mock("../src/lib/prisma", async () => {
  const { createFakePrisma } = await import("./helpers/fake-prisma");
  return { prisma: createFakePrisma() };
});
vi.mock("../src/lib/mongo", () => ({ getProfilesCollection: async () => null, getDb: async () => null }));
vi.mock("../src/lib/clerk-users", () => ({ fetchClerkUsers: vi.fn(async () => new Map()) }));
vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));

import app from "../src/index";
import { prisma } from "../src/lib/prisma";
import { signUnsubscribeToken } from "../src/lib/email-tokens";

const db = prisma as unknown as ReturnType<typeof import("./helpers/fake-prisma").createFakePrisma>;

function signedHeaders(body: string, id = `msg_${Math.random().toString(36).slice(2)}`, secret = WEBHOOK_SECRET) {
  const timestamp = new Date();
  const signature = new Webhook(secret).sign(id, timestamp, body);
  return {
    "content-type": "application/json",
    "svix-id": id,
    "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "svix-signature": signature,
  };
}

function event(type: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ type, created_at: new Date().toISOString(), data: { email_id: "msg_1", to: ["a@example.com"], ...extra } });
}

beforeEach(async () => {
  db.$reset();
  await db.campaign.create({ data: { key: "weekly-2026-W40", name: "W40", kind: "weekly", status: "completed", jobCount: 5 } });
  await db.emailPreference.create({ data: { userId: "user_1", email: "a@example.com", subscribed: true, frequency: "weekly", unsubscribeToken: "stored-token-1" } });
  await db.nudgeSend.create({
    data: { id: "send_1", campaignId: 1, userId: "user_1", email: "a@example.com", status: "sent", providerMessageId: "msg_1", jobIds: [23], sentAt: new Date() },
  });
  await db.recruiter.create({ data: { id: 1, name: "R", linkedinUrl: "https://linkedin.com/in/r", active: true } });
  await db.job.create({
    data: { id: 23, recruiterId: 1, title: "SDE 1", company: "M2P", sourceUrl: "https://www.linkedin.com/posts/m2p-sde1", postedAt: new Date(), seniority: "junior", source: "linkedin", roleFamily: "engineering" },
  });
});

describe("POST /api/email/webhook", () => {
  it("accepts a correctly signed event and records delivery", async () => {
    const body = event("email.delivered");
    const res = await app.request("/api/email/webhook", { method: "POST", body, headers: signedHeaders(body) });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ received: true, outcome: "delivered" });
    const send = await db.nudgeSend.findUnique({ where: { id: "send_1" } });
    expect(send!.status).toBe("delivered");
    expect(send!.deliveredAt).toBeInstanceOf(Date);
    expect(await db.emailEvent.count({})).toBe(1);
  });

  it("rejects a bad signature and records nothing", async () => {
    const body = event("email.delivered");
    const headers = signedHeaders(body, "msg_bad", `whsec_${Buffer.from("another-secret").toString("base64")}`);
    const res = await app.request("/api/email/webhook", { method: "POST", body, headers });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid signature" });
    expect(await db.emailEvent.count({})).toBe(0);
    expect((await db.nudgeSend.findUnique({ where: { id: "send_1" } }))!.status).toBe("sent");
  });

  it("rejects a tampered body and missing headers", async () => {
    const body = event("email.delivered");
    const headers = signedHeaders(body);
    const tampered = await app.request("/api/email/webhook", { method: "POST", body: event("email.complained"), headers });
    expect(tampered.status).toBe(400);
    const missing = await app.request("/api/email/webhook", { method: "POST", body, headers: { "content-type": "application/json" } });
    expect(missing.status).toBe(400);
  });

  it("deduplicates by svix-id", async () => {
    const body = event("email.opened");
    const headers = signedHeaders(body, "msg_dup");
    expect((await app.request("/api/email/webhook", { method: "POST", body, headers })).status).toBe(200);
    const again = await app.request("/api/email/webhook", { method: "POST", body, headers });
    await expect(again.json()).resolves.toMatchObject({ received: true, duplicate: true });
    expect(await db.emailEvent.count({})).toBe(1);
  });

  it("auto-unsubscribes on a hard bounce", async () => {
    const body = event("email.bounced", { bounce: { type: "Permanent", subType: "General", message: "mailbox does not exist" } });
    const res = await app.request("/api/email/webhook", { method: "POST", body, headers: signedHeaders(body) });
    expect(res.status).toBe(200);
    const pref = await db.emailPreference.findUnique({ where: { userId: "user_1" } });
    expect(pref!.subscribed).toBe(false);
    expect(pref!.unsubscribeReason).toBe("bounce");
    expect((await db.nudgeSend.findUnique({ where: { id: "send_1" } }))!.status).toBe("bounced");
  });

  it("keeps a soft bounce subscribed", async () => {
    const body = event("email.bounced", { bounce: { type: "Transient" } });
    await app.request("/api/email/webhook", { method: "POST", body, headers: signedHeaders(body) });
    expect((await db.emailPreference.findUnique({ where: { userId: "user_1" } }))!.subscribed).toBe(true);
  });

  it("auto-unsubscribes on a complaint", async () => {
    const body = event("email.complained");
    await app.request("/api/email/webhook", { method: "POST", body, headers: signedHeaders(body) });
    const pref = await db.emailPreference.findUnique({ where: { userId: "user_1" } });
    expect(pref!.subscribed).toBe(false);
    expect(pref!.unsubscribeReason).toBe("complaint");
    const send = await db.nudgeSend.findUnique({ where: { id: "send_1" } });
    expect(send!.status).toBe("complained");
    expect(send!.unsubscribedAt).toBeInstanceOf(Date);
  });

  it("records provider clicks with the job id parsed from the /go link", async () => {
    const body = event("email.clicked", { click: { link: "https://skiptheboard.in/go/send_1/23" } });
    await app.request("/api/email/webhook", { method: "POST", body, headers: signedHeaders(body) });
    const clicks = await db.nudgeClick.findMany({});
    expect(clicks).toHaveLength(1);
    expect(clicks[0]).toMatchObject({ sendId: "send_1", jobId: 23, source: "webhook" });
    expect((await db.nudgeSend.findUnique({ where: { id: "send_1" } }))!.clickedAt).toBeInstanceOf(Date);
  });

  it("ignores events for unknown messages", async () => {
    const body = event("email.delivered", { email_id: "msg_unknown" });
    const res = await app.request("/api/email/webhook", { method: "POST", body, headers: signedHeaders(body) });
    await expect(res.json()).resolves.toMatchObject({ outcome: "ignored: unknown message" });
  });
});

describe("one-click unsubscribe", () => {
  it("unsubscribes with a valid signed token, via GET and the RFC 8058 POST", async () => {
    const token = signUnsubscribeToken("stored-token-1");
    const res = await app.request(`/api/email/unsubscribe?t=${encodeURIComponent(token)}`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, subscribed: false, email: "a*@example.com" });
    const pref = await db.emailPreference.findUnique({ where: { userId: "user_1" } });
    expect(pref!.subscribed).toBe(false);
    expect(pref!.unsubscribeReason).toBe("user");
    expect((await db.nudgeSend.findUnique({ where: { id: "send_1" } }))!.unsubscribedAt).toBeInstanceOf(Date);

    await db.emailPreference.update({ where: { userId: "user_1" }, data: { subscribed: true, unsubscribedAt: null, unsubscribeReason: null } });
    const post = await app.request(`/api/email/unsubscribe?t=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    });
    expect(post.status).toBe(200);
    expect((await db.emailPreference.findUnique({ where: { userId: "user_1" } }))!.subscribed).toBe(false);
  });

  it("rejects a forged or missing token", async () => {
    const forged = `${Buffer.from("stored-token-1").toString("base64url")}.forgedsignature`;
    expect((await app.request(`/api/email/unsubscribe?t=${forged}`)).status).toBe(400);
    expect((await app.request("/api/email/unsubscribe")).status).toBe(400);
    const unknown = signUnsubscribeToken("not-a-stored-token");
    expect((await app.request(`/api/email/unsubscribe?t=${encodeURIComponent(unknown)}`)).status).toBe(400);
    expect((await db.emailPreference.findUnique({ where: { userId: "user_1" } }))!.subscribed).toBe(true);
  });

  it("can resubscribe from the same link", async () => {
    const token = signUnsubscribeToken("stored-token-1");
    await app.request(`/api/email/unsubscribe?t=${encodeURIComponent(token)}`);
    const res = await app.request(`/api/email/unsubscribe?t=${encodeURIComponent(token)}&action=resubscribe`, { method: "POST" });
    await expect(res.json()).resolves.toMatchObject({ ok: true, subscribed: true });
  });
});

describe("GET /go/:sendId/:jobId", () => {
  it("logs the click and redirects to the original post", async () => {
    const res = await app.request("/go/send_1/23");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://www.linkedin.com/posts/m2p-sde1");
    const clicks = await db.nudgeClick.findMany({});
    expect(clicks).toHaveLength(1);
    expect(clicks[0]).toMatchObject({ sendId: "send_1", jobId: 23, source: "redirect" });
    expect((await db.nudgeSend.findUnique({ where: { id: "send_1" } }))!.clickedAt).toBeInstanceOf(Date);
  });

  it("falls back to the feed for unknown ids without logging", async () => {
    const res = await app.request("/go/nope/999");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(/^https:\/\/skiptheboard\.in\/\?utm_source=nudge/);
    expect(await db.nudgeClick.count({})).toBe(0);
  });
});
