import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/prisma", async () => {
  const { createFakePrisma } = await import("./helpers/fake-prisma");
  return { prisma: createFakePrisma() };
});
vi.mock("../src/lib/mongo", async () => {
  const { createFakeProfiles } = await import("./helpers/fake-prisma");
  const profiles = createFakeProfiles([]);
  return { getProfilesCollection: async () => profiles, getDb: async () => null };
});
vi.mock("../src/lib/clerk-users", () => ({ fetchClerkUsers: vi.fn(async () => new Map()) }));
vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));

import { prisma } from "../src/lib/prisma";
import { getProfilesCollection } from "../src/lib/mongo";
import { foldSendCounts, jobStats, subscriberStats } from "../src/lib/nudge-stats";

const db = prisma as unknown as ReturnType<typeof import("./helpers/fake-prisma").createFakePrisma>;
const NOW = new Date("2026-09-29T08:00:00Z");
const blank = { variantId: null, deliveredAt: null, openedAt: null, clickedAt: null, bouncedAt: null, complainedAt: null, unsubscribedAt: null };

async function seedProfiles(ids: string[]) {
  const collection = (await getProfilesCollection()) as unknown as { docs: Record<string, unknown>[] };
  collection.docs.length = 0;
  for (const id of ids) {
    collection.docs.push({ _id: id, filterSummary: { roleFamily: "engineering" }, createdAt: new Date("2026-09-01T00:00:00Z") });
  }
}

beforeEach(async () => {
  db.$reset();
  await seedProfiles([]);
});

describe("foldSendCounts", () => {
  it("divides open and click rates by emails sent, never by delivered", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      ...blank,
      status: "sent",
      deliveredAt: i === 0 ? NOW : null,
      openedAt: i < 3 ? NOW : null,
      clickedAt: i < 2 ? NOW : null,
    }));
    expect(foldSendCounts(rows)).toMatchObject({ sent: 100, delivered: 1, opened: 3, clicked: 2, openRate: 3, clickRate: 2 });
  });

  it("reports no rate until something was sent", () => {
    const counts = foldSendCounts([
      { ...blank, status: "holdout" },
      { ...blank, status: "skipped" },
      { ...blank, status: "dry_run" },
    ]);
    expect(counts).toMatchObject({ recipients: 1, sent: 0, dryRun: 1, holdout: 1, skipped: 1, openRate: null, clickRate: null });
  });
});

describe("subscriberStats", () => {
  it("counts preferences only for users who have a resume profile", async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `user_${i}`);
    await seedProfiles(ids);
    await db.emailPreference.create({
      data: { userId: "no_resume", subscribed: false, frequency: "weekly", unsubscribeToken: "t0", unsubscribeReason: "user" },
    });
    await db.emailPreference.create({ data: { userId: "user_1", subscribed: true, frequency: "daily", unsubscribeToken: "t1" } });

    const stats = await subscriberStats(NOW);

    expect(stats).toMatchObject({
      eligible: 10,
      subscribed: 10,
      unsubscribed: 0,
      paused: 0,
      newThisWeek: 0,
      byFrequency: { weekly: 9, daily: 1 },
      unsubscribeReasons: {},
    });
  });
});

describe("jobStats", () => {
  it("counts only clicks on jobs in the email click total", async () => {
    await db.recruiter.create({ data: { id: 1, name: "R", linkedinUrl: "https://linkedin.com/in/r", active: true } });
    const campaign = await db.campaign.create({ data: { key: "w", name: "W", kind: "weekly", status: "completed", jobCount: 5 } });
    await db.nudgeSend.create({
      data: { id: "s1", campaignId: campaign.id, userId: "u", email: "u@example.com", status: "sent", jobIds: [23], sentAt: NOW },
    });
    await db.nudgeClick.create({ data: { sendId: "s1", jobId: 23, source: "redirect" } });
    await db.nudgeClick.create({ data: { sendId: "s1", jobId: null, source: "webhook", url: "https://skiptheboard.in/profile" } });

    const stats = await jobStats(NOW);

    expect(stats.totalEmailClicks).toBe(1);
    expect(stats.jobClicks).toEqual([{ jobId: 23, clicks: 1, title: null, company: null }]);
  });
});
