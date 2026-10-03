// Send controls and experiments. Mounted under /api/admin/nudges behind the
// admin guard. Manual sends run with a short budget and continue themselves.

import { Hono } from "hono";
import { fetchClerkUsers } from "../lib/clerk-users.js";
import { getProfilesCollection } from "../lib/mongo.js";
import {
  continueCampaignLater,
  createManualCampaign,
  isSchedulePaused,
  nextNudgeTick,
  previewNudgeForUser,
  runCampaign,
  scheduledCampaignFor,
  sendTestNudge,
  setSchedulePaused,
} from "../lib/nudge-send.js";
import { DEFAULT_NUDGE_JOB_COUNT } from "../lib/nudge-select.js";
import { validateVariants } from "../lib/nudge-variants.js";
import { prisma } from "../lib/prisma.js";

type Variables = { userId: string | null; adminVia: "secret" | "clerk" };

const nudges = new Hono<{ Variables: Variables }>();

const MANUAL_BUDGET_MS = 45_000;

// GET /api/admin/nudges/users?q= — recipients for the preview picker
nudges.get("/users", async (c) => {
  const q = (c.req.query("q") ?? "").trim().toLowerCase();
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? 25) || 25));
  const collection = await getProfilesCollection();
  if (!collection) return c.json({ users: [] });

  const docs = (await collection
    .find({ filterSummary: { $exists: true } }, { projection: { _id: 1, contact: 1, filterSummary: 1, updatedAt: 1 } })
    .sort({ updatedAt: -1 })
    .limit(500)
    .toArray()) as unknown as {
    _id: string;
    contact?: { name?: string; email?: string };
    filterSummary?: { currentTitle?: string; seniority?: string; roleFamily?: string };
    updatedAt?: Date;
  }[];

  const filtered = q
    ? docs.filter((d) =>
        [d._id, d.contact?.name, d.contact?.email, d.filterSummary?.currentTitle]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      )
    : docs;
  const page = filtered.slice(0, limit);
  const ids = page.map((d) => String(d._id));
  const [clerk, prefs] = await Promise.all([
    fetchClerkUsers(ids),
    prisma.emailPreference.findMany({ where: { userId: { in: ids } } }),
  ]);
  const prefById = new Map(prefs.map((p) => [p.userId, p]));

  return c.json({
    users: page.map((d) => {
      const id = String(d._id);
      const pref = prefById.get(id);
      return {
        userId: id,
        name: d.contact?.name ?? null,
        email: clerk.get(id)?.email ?? null,
        currentTitle: d.filterSummary?.currentTitle ?? null,
        seniority: d.filterSummary?.seniority ?? null,
        roleFamily: d.filterSummary?.roleFamily ?? null,
        subscribed: pref?.subscribed ?? true,
        frequency: pref?.frequency ?? "weekly",
        pausedUntil: pref?.pausedUntil?.toISOString() ?? null,
        lastSentAt: pref?.lastSentAt?.toISOString() ?? null,
      };
    }),
    total: filtered.length,
  });
});

// GET /api/admin/nudges/preview?userId=&campaignId=&variantId=
nudges.get("/preview", async (c) => {
  const userId = c.req.query("userId")?.trim();
  if (!userId) return c.json({ error: "userId is required" }, 400);
  const campaignId = c.req.query("campaignId") ? Number(c.req.query("campaignId")) : null;
  const variantId = c.req.query("variantId") ? Number(c.req.query("variantId")) : null;
  const preview = await previewNudgeForUser({
    userId,
    campaignId: Number.isInteger(campaignId) ? campaignId : null,
    variantId: Number.isInteger(variantId) ? variantId : null,
  });
  return c.json(preview);
});

// POST /api/admin/nudges/test { to, userId, campaignId?, variantId? }
nudges.post("/test", async (c) => {
  const body = await c.req.json().catch(() => ({})) as {
    to?: string;
    userId?: string;
    campaignId?: number;
    variantId?: number;
  };
  const to = body.to?.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return c.json({ error: "a valid `to` address is required" }, 400);
  if (!body.userId) return c.json({ error: "userId is required (whose matches to render)" }, 400);
  const result = await sendTestNudge({
    to,
    userId: body.userId,
    campaignId: body.campaignId ?? null,
    variantId: body.variantId ?? null,
  });
  return c.json(result, result.ok ? 200 : 422);
});

// GET /api/admin/nudges/schedule
nudges.get("/schedule", async (c) => {
  const tick = nextNudgeTick(new Date());
  return c.json({
    paused: await isSchedulePaused(),
    cron: "30 2 * * *",
    description: "Daily at 02:30 UTC (08:00 IST). Mondays send the weekly campaign to everyone; other days send only to users who chose daily.",
    nextTickAt: tick.toISOString(),
    nextTickWouldRun: scheduledCampaignFor(tick),
  });
});

// PUT /api/admin/nudges/schedule { paused }
nudges.put("/schedule", async (c) => {
  const body = await c.req.json().catch(() => ({})) as { paused?: unknown };
  if (typeof body.paused !== "boolean") return c.json({ error: "paused must be a boolean" }, 400);
  await setSchedulePaused(body.paused);
  return c.json({ paused: body.paused });
});

// GET /api/admin/nudges/campaigns
nudges.get("/campaigns", async (c) => {
  const campaigns = await prisma.campaign.findMany({
    include: { variants: { orderBy: { id: "asc" } }, _count: { select: { sends: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return c.json({
    campaigns: campaigns.map((cp) => ({
      id: cp.id,
      key: cp.key,
      name: cp.name,
      kind: cp.kind,
      status: cp.status,
      jobCount: cp.jobCount,
      createdBy: cp.createdBy,
      createdAt: cp.createdAt.toISOString(),
      startedAt: cp.startedAt?.toISOString() ?? null,
      completedAt: cp.completedAt?.toISOString() ?? null,
      sends: cp._count.sends,
      variants: cp.variants,
    })),
  });
});

interface VariantBody {
  key?: string;
  name?: string;
  weight?: number;
  isHoldout?: boolean;
  subject?: string | null;
  intro?: string | null;
  jobCount?: number | null;
}

// POST /api/admin/nudges/campaigns { name, kind?, jobCount?, variants: [...] }
nudges.post("/campaigns", async (c) => {
  const body = await c.req.json().catch(() => null) as {
    name?: string;
    kind?: string;
    jobCount?: number;
    variants?: VariantBody[];
  } | null;
  if (!body?.name?.trim()) return c.json({ error: "name is required" }, 400);
  const variants = Array.isArray(body.variants) ? body.variants : [];
  if (variants.length < 2) return c.json({ error: "an experiment needs at least 2 variants (one may be a holdout)" }, 400);

  const arms = variants.map((v, i) => ({
    key: (v.key ?? String.fromCharCode(65 + i)).trim(),
    name: (v.name ?? `Variant ${String.fromCharCode(65 + i)}`).trim(),
    weight: Number(v.weight),
    isHoldout: v.isHoldout === true,
    subject: v.subject?.trim() || null,
    intro: v.intro?.trim() || null,
    jobCount: v.jobCount != null && Number.isInteger(Number(v.jobCount)) && Number(v.jobCount) > 0 ? Number(v.jobCount) : null,
  }));
  const problem = validateVariants(arms);
  if (problem) return c.json({ error: problem }, 400);

  const jobCount = Number.isInteger(body.jobCount) && Number(body.jobCount) > 0 ? Number(body.jobCount) : DEFAULT_NUDGE_JOB_COUNT;
  const slug = body.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "experiment";
  const key = `exp-${slug}-${Date.now().toString(36)}`;
  const campaign = await prisma.campaign.create({
    data: {
      key,
      name: body.name.trim(),
      kind: "experiment",
      jobCount,
      createdBy: c.get("userId") ?? "admin-secret",
      variants: { create: arms },
    },
    include: { variants: true },
  });
  return c.json({ campaign }, 201);
});

// POST /api/admin/nudges/send-now { campaignId? } — run now; continues itself if long
nudges.post("/send-now", async (c) => {
  const body = await c.req.json().catch(() => ({})) as { campaignId?: number };
  let campaignId = body.campaignId;
  if (!campaignId) {
    const created = await createManualCampaign(c.get("userId") ?? "admin-secret");
    campaignId = created.id;
  } else {
    const exists = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!exists) return c.json({ error: "Campaign not found" }, 404);
    if (exists.status === "completed") return c.json({ error: "Campaign already completed" }, 409);
  }
  const result = await runCampaign({ campaignId, budgetMs: MANUAL_BUDGET_MS });
  if (result.remaining > 0) continueCampaignLater(campaignId);
  return c.json(result);
});

export default nudges;
