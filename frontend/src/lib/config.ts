// ─── App-wide configuration ──────────────────────────────────────────────────

/** Job posts auto-expire after this many days. Shared between frontend and backend. */
export const JOB_EXPIRY_DAYS = 30;

/** Backend API URL — uses NEXT_PUBLIC_BACKEND_URL env var, falls back to production. */
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://backend-umber-nu-43.vercel.app";

/** API key for backend requests. */
export const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? process.env.API_KEY;
