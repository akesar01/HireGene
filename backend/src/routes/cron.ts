import { Hono } from "hono";
import type { Context } from "hono";
import { JOB_EXPIRY_DAYS } from "../lib/config.js";
import { purgeExpiredJobs } from "../lib/job-expiry.js";
import { scrapeDueBatch } from "../lib/scrape-due.js";

const cron = new Hono();

cron.use("*", async (c, next) => {
  const auth = c.req.header("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const allowed = [process.env.CRON_SECRET, process.env.ADMIN_SECRET].filter(
    (value): value is string => Boolean(value),
  );

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
          `created=${item.jobsCreated} skipped=${item.jobsSkipped}`,
      );
    } else {
      console.error(
        `[cron] scrape: recruiter ${item.recruiterId} (${item.name}) failed: ${item.error}`,
      );
    }
  }

  if (batch.results.length === 0) {
    return c.json({
      ok: true,
      processed: 0,
      failed: 0,
      dueBefore: 0,
      remaining: 0,
      exhaustedBudget: false,
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
    results: batch.results,
  });
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

cron.get("/scrape", handleScrape);
cron.post("/scrape", handleScrape);
cron.get("/expire-jobs", handleExpireJobs);
cron.post("/expire-jobs", handleExpireJobs);

export default cron;
