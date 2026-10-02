import { Hono } from "hono";
import type { Context } from "hono";
import { JOB_EXPIRY_DAYS } from "../lib/config.js";
import { purgeExpiredJobs } from "../lib/job-expiry.js";
import { scrapeDueBatch } from "../lib/scrape-due.js";
import { shouldStartScrapeDrain } from "../lib/scrape-chain.js";
import { continueCampaignLater, ensureScheduledCampaign, runCampaign } from "../lib/nudge-send.js";

const cron = new Hono();

cron.use("*", async (c, next) => {
  const auth = c.req.header("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const allowed = [
    process.env.CRON_SECRET,
    process.env.ADMIN_SECRET,
    process.env.SCRAPE_TICK_TOKEN,
  ].filter((value): value is string => Boolean(value));

  if (!token || !allowed.includes(token)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});

async function handleScrape(c: Context) {
  const once = c.req.query("once") === "1" || c.req.query("once") === "true";
  const budgetMs = once
    ? 120_000
    : Number(process.env.SCRAPE_BUDGET_MS ?? 240_000);

  const batch = await scrapeDueBatch({ once, budgetMs });

  for (const item of batch.results) {
    if (item.ok) {
      console.log(
        `[cron] scrape: recruiter ${item.recruiterId} (${item.name}) ` +
          `created=${item.jobsCreated} skipped=${item.jobsSkipped}` +
          `${item.skipReasons ? ` ${item.skipReasons}` : ""}` +
          `${item.pending ? " pending=true" : ""}`,
      );
    } else {
      console.error(
        `[cron] scrape: recruiter ${item.recruiterId} (${item.name}) failed: ${item.error}`,
      );
    }
  }

  const callerToken = c.req.header("Authorization")?.startsWith("Bearer ")
    ? c.req.header("Authorization")!.slice("Bearer ".length)
    : "";
  if (shouldStartScrapeDrain({
    callerToken,
    cronSecret: process.env.CRON_SECRET,
    remaining: batch.remaining,
    once,
  })) {
    await dispatchScrapeDrain();
  } else if (!once && batch.remaining > 0) {
    console.log(`[cron] scrape: remaining=${batch.remaining}`);
  }

  if (batch.results.length === 0) {
    return c.json({
      ok: true,
      processed: 0,
      failed: 0,
      dueBefore: 0,
      remaining: 0,
      exhaustedBudget: false,
      pending: 0,
      message: "No recruiters due",
      results: [],
    });
  }

  return c.json({
    ok: batch.failed === 0,
    processed: batch.processed,
    failed: batch.failed,
    dueBefore: batch.dueBefore,
    remaining: batch.remaining,
    exhaustedBudget: batch.exhaustedBudget,
    pending: batch.pending,
    results: batch.results,
  });
}

async function dispatchScrapeDrain(): Promise<void> {
  const githubToken = process.env.GITHUB_DISPATCH_TOKEN;
  if (!githubToken) {
    console.error("[cron] GITHUB_DISPATCH_TOKEN is not set; scrape drain not started");
    return;
  }
  const res = await fetch(
    "https://api.github.com/repos/akesar01/HireGene/actions/workflows/scrape-tick.yml/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "hiregene-scrape",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  );
  if (res.status === 204) {
    console.log("[cron] started GitHub scrape drain");
    return;
  }
  const body = await res.text();
  console.error(`[cron] GitHub scrape drain failed: ${res.status} ${body.slice(0, 180)}`);
}

async function handleExpireJobs(c: Context) {
  const deleted = await purgeExpiredJobs();
  console.log(`[cron] expire-jobs: deleted=${deleted} (older than ${JOB_EXPIRY_DAYS} days)`);
  return c.json({
    ok: true,
    deleted,
    expiryDays: JOB_EXPIRY_DAYS,
    message: `Deleted ${deleted} jobs older than ${JOB_EXPIRY_DAYS} days`,
  });
}

// Daily 02:30 UTC. Mondays: weekly campaign to all subscribers. Other days:
// daily campaign, only when someone chose daily. `?campaign=<id>` continues
// a specific campaign (self-continuation after the time budget).
async function handleNudges(c: Context) {
  const explicit = c.req.query("campaign");
  let campaignId: number | null = null;
  if (explicit) {
    campaignId = Number(explicit);
    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      return c.json({ error: "campaign must be a positive integer" }, 400);
    }
  } else {
    const campaign = await ensureScheduledCampaign(new Date());
    if (!campaign) {
      return c.json({ ok: true, skipped: true, message: "No campaign scheduled today (paused, or no daily subscribers)" });
    }
    campaignId = campaign.id;
  }

  const result = await runCampaign({ campaignId });
  console.log(
    `[cron] nudges: campaign=${result.campaignKey} processed=${result.processed} sent=${result.sent} ` +
      `skipped=${result.skipped} holdout=${result.holdout} failed=${result.failed} remaining=${result.remaining}` +
      `${result.dryRun ? " dryRun=true" : ""}`,
  );
  if (result.remaining > 0) continueCampaignLater(campaignId);
  return c.json({ ok: result.failed === 0, ...result });
}

cron.get("/scrape", handleScrape);
cron.post("/scrape", handleScrape);
cron.get("/expire-jobs", handleExpireJobs);
cron.post("/expire-jobs", handleExpireJobs);
cron.get("/nudges", handleNudges);
cron.post("/nudges", handleNudges);

export default cron;
