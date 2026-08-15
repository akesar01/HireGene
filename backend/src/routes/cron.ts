import { waitUntil } from "@vercel/functions";
import { Hono } from "hono";
import type { Context } from "hono";
import { scrapeNextDue } from "../lib/scrape-due.js";
import {
  buildContinueUrl,
  parseExcludeIds,
} from "../lib/scrape-schedule.js";

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
  const excludeIds = parseExcludeIds(c.req.query("exclude"));
  const once = c.req.query("once") === "1" || c.req.query("once") === "true";
  const isContinue = c.req.query("continue") === "1";
  const authorization = c.req.header("Authorization") ?? "";

  if (isContinue) {
    const backgrounded = runInBackground(c, async () => {
      const outcome = await scrapeNextDue(excludeIds);
      logOutcome("continue", outcome);
      await maybeContinue(c, {
        excludeIds,
        authorization,
        once,
        outcome,
      });
    });

    return c.json(
      {
        ok: true,
        accepted: true,
        continued: true,
        message: backgrounded
          ? "Continuation accepted"
          : "Continuation processed",
      },
      202,
    );
  }

  const outcome = await scrapeNextDue(excludeIds);
  logOutcome("scrape", outcome);

  const continued = await maybeContinue(c, {
    excludeIds,
    authorization,
    once,
    outcome,
  });

  if (!outcome.picked) {
    return c.json({
      ok: true,
      processed: 0,
      dueBefore: 0,
      remaining: 0,
      continued: false,
      message: "No recruiters due",
    });
  }

  return c.json({
    ok: outcome.error === null,
    processed: outcome.error === null ? 1 : 0,
    dueBefore: outcome.dueCount,
    remaining: outcome.remaining,
    continued,
    recruiter: {
      id: outcome.picked.id,
      name: outcome.picked.name,
    },
    result: outcome.result,
    error: outcome.error,
  });
}

async function maybeContinue(
  c: Context,
  opts: {
    excludeIds: number[];
    authorization: string;
    once: boolean;
    outcome: Awaited<ReturnType<typeof scrapeNextDue>>;
  },
): Promise<boolean> {
  if (opts.once || !opts.outcome.picked || opts.outcome.remaining <= 0) {
    return false;
  }

  const nextExclude =
    opts.outcome.error === null
      ? opts.excludeIds
      : [...opts.excludeIds, opts.outcome.picked.id];
  const nextUrl = buildContinueUrl(c.req.url, nextExclude);

  const hop = fetch(nextUrl, {
    method: "POST",
    headers: { Authorization: opts.authorization },
  }).then(async (res) => {
    await res.text().catch(() => {});
    if (!res.ok) {
      console.error(`[cron] continue hop failed: ${res.status} ${nextUrl}`);
    }
  }).catch((err) => {
    console.error("[cron] continue hop error:", err);
  });

  runInBackground(c, () => hop);
  return true;
}

function runInBackground(c: Context, work: () => Promise<unknown>): boolean {
  const task = work();

  try {
    c.executionCtx.waitUntil(task);
    return true;
  } catch {
    // No request execution context (local node server).
  }

  // @vercel/functions no-ops off-platform, so only trust it on Vercel.
  if (process.env.VERCEL) {
    waitUntil(task);
    return true;
  }

  void task;
  return false;
}

function logOutcome(
  phase: "scrape" | "continue",
  outcome: Awaited<ReturnType<typeof scrapeNextDue>>,
) {
  if (!outcome.picked) {
    console.log(`[cron] ${phase}: no recruiters due`);
    return;
  }

  if (outcome.error) {
    console.error(
      `[cron] ${phase}: recruiter ${outcome.picked.id} (${outcome.picked.name}) failed: ${outcome.error}`,
    );
    return;
  }

  console.log(
    `[cron] ${phase}: recruiter ${outcome.picked.id} (${outcome.picked.name}) ` +
      `created=${outcome.result?.jobsCreated ?? 0} skipped=${outcome.result?.jobsSkipped ?? 0} ` +
      `remaining=${outcome.remaining}`,
  );
}

cron.get("/scrape", handleScrape);
cron.post("/scrape", handleScrape);

export default cron;
