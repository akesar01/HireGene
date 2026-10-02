// Admin access: either the machine ADMIN_SECRET bearer (scripts, curl) or a
// Clerk user whose id is in ADMIN_USER_IDS or whose primary Clerk email is in
// ADMIN_EMAILS. The browser only ever uses the Clerk path.

import { fetchClerkUsers } from "./clerk-users.js";

function csvSet(raw: string | undefined, lower = false): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => (lower ? value.toLowerCase() : value)),
  );
}

export function adminUserIds(env: NodeJS.ProcessEnv = process.env): Set<string> {
  return csvSet(env.ADMIN_USER_IDS);
}

export function adminEmails(env: NodeJS.ProcessEnv = process.env): Set<string> {
  return csvSet(env.ADMIN_EMAILS, true);
}

export function isAdminUserId(userId: string | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!userId) return false;
  return adminUserIds(env).has(userId);
}

export function isAdminEmail(email: string | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!email) return false;
  return adminEmails(env).has(email.trim().toLowerCase());
}

export type EmailResolver = (userId: string) => Promise<string | null>;

// Clerk lookups are cached per process for a few minutes so a dashboard
// session does not call Clerk on every request.
const EMAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const emailCache = new Map<string, { email: string | null; expiresAt: number }>();

export const defaultEmailResolver: EmailResolver = async (userId) => {
  const cached = emailCache.get(userId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.email;
  const users = await fetchClerkUsers([userId]);
  const email = users.get(userId)?.email ?? null;
  emailCache.set(userId, { email, expiresAt: now + EMAIL_CACHE_TTL_MS });
  return email;
};

export function clearAdminEmailCache(): void {
  emailCache.clear();
}

/** True when the Clerk user is an admin by id or by primary email. */
export async function isAdminUser(
  userId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
  resolveEmail: EmailResolver = defaultEmailResolver,
): Promise<boolean> {
  if (!userId) return false;
  if (isAdminUserId(userId, env)) return true;
  if (adminEmails(env).size === 0) return false;
  try {
    return isAdminEmail(await resolveEmail(userId), env);
  } catch (err) {
    console.warn("[admin] email lookup failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export type AdminAuthDecision =
  | { ok: true; via: "secret" | "clerk"; userId: string | null }
  | { ok: false; status: 401 | 403; error: string };

export async function decideAdminAuth(options: {
  authHeader: string | undefined;
  userId: string | null | undefined;
  env?: NodeJS.ProcessEnv;
  resolveEmail?: EmailResolver;
}): Promise<AdminAuthDecision> {
  const env = options.env ?? process.env;
  const secret = env.ADMIN_SECRET;
  if (secret && options.authHeader === `Bearer ${secret}`) {
    return { ok: true, via: "secret", userId: null };
  }
  if (!options.userId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  if (!(await isAdminUser(options.userId, env, options.resolveEmail))) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, via: "clerk", userId: options.userId };
}
