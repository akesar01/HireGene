// Public origins used in emails and redirects.

import { scrapeSelfUrl } from "./scrape-chain.js";

/** Frontend origin, e.g. https://skiptheboard.in (no trailing slash). */
export function frontendUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.FRONTEND_URL ?? "https://skiptheboard.in").replace(/\/$/, "");
}

/** This backend's public origin (no trailing slash). */
export function backendUrl(env: NodeJS.ProcessEnv = process.env): string {
  return scrapeSelfUrl(env);
}
