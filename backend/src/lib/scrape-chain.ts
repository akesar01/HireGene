import { waitUntil } from "@vercel/functions";

/** Pause between Apify batches of 5 so Free-plan concurrency stays at 5. */
export const SCRAPE_BATCH_GAP_MS = 10 * 60 * 1000;

/** Stay under Vercel Hobby maxDuration (300s). */
export const SCRAPE_DELAY_HOP_MS = 280_000;

export function nextDelayHop(
  delayMs: number,
  maxSleepMs: number = SCRAPE_DELAY_HOP_MS,
): { sleepMs: number; leftoverMs: number } {
  const delay = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 0;
  const cap = Number.isFinite(maxSleepMs) && maxSleepMs > 0 ? maxSleepMs : SCRAPE_DELAY_HOP_MS;
  const sleepMs = Math.min(delay, cap);
  return { sleepMs, leftoverMs: Math.max(delay - sleepMs, 0) };
}

export function scrapeSelfUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.SCRAPE_SELF_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const prod = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod.replace(/^https?:\/\//, "")}`;
  return "https://backend-umber-nu-43.vercel.app";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runScrapeDelayHop(options: {
  delayMs: number;
  authorization: string;
  env?: NodeJS.ProcessEnv;
}): Promise<"delayed" | "scraped"> {
  const env = options.env ?? process.env;
  const base = scrapeSelfUrl(env);
  const { sleepMs, leftoverMs } = nextDelayHop(options.delayMs);
  if (sleepMs > 0) await sleep(sleepMs);

  const headers = {
    Authorization: options.authorization,
    "Content-Type": "application/json",
  };

  if (leftoverMs > 5_000) {
    const res = await fetch(`${base}/api/cron/scrape-delay`, {
      method: "POST",
      headers,
      body: JSON.stringify({ delayMs: leftoverMs }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`scrape-delay hop failed: ${res.status} ${body}`);
    }
    return "delayed";
  }

  const res = await fetch(`${base}/api/cron/scrape`, {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`scrape continue failed: ${res.status} ${body}`);
  }
  return "scraped";
}

/** Fire a 10-minute continue without blocking the current scrape response. */
export function scheduleNextScrapeBatch(options: {
  delayMs?: number;
  authorization: string;
  env?: NodeJS.ProcessEnv;
}): void {
  const delayMs = options.delayMs ?? SCRAPE_BATCH_GAP_MS;
  const authorization = options.authorization;
  const env = options.env ?? process.env;
  const base = scrapeSelfUrl(env);
  waitUntil(
    fetch(`${base}/api/cron/scrape-delay`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ delayMs }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`scrape-delay start failed: ${res.status} ${body}`);
        }
      })
      .catch((err) => {
        console.error(
          `[cron] failed to schedule next scrape batch: ${err instanceof Error ? err.message : err}`,
        );
      }),
  );
}
