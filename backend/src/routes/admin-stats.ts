// Dashboard read models. Mounted under /api/admin/stats behind the admin guard.

import { Hono } from "hono";
import { campaignStats, jobStats, subscriberStats, topClickedJobs } from "../lib/nudge-stats.js";

const stats = new Hono();

stats.get("/subscribers", async (c) => {
  return c.json(await subscriberStats());
});

stats.get("/email", async (c) => {
  const campaignId = c.req.query("campaignId") ? Number(c.req.query("campaignId")) : undefined;
  const [campaigns, topJobs] = await Promise.all([
    campaignStats(Number.isInteger(campaignId) ? campaignId : undefined),
    topClickedJobs(10, Number.isInteger(campaignId) ? campaignId : undefined),
  ]);
  return c.json({ campaigns, topClickedJobs: topJobs });
});

stats.get("/jobs", async (c) => {
  const days = Math.min(60, Math.max(7, Number(c.req.query("days") ?? 14) || 14));
  return c.json(await jobStats(new Date(), days));
});

export default stats;
