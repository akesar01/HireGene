import { verifyToken } from "@clerk/backend";
import type { Context, Next } from "hono";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

export async function clerkOptionalAuth(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    c.set("userId", null);
    await next();
    return;
  }

  const token = authHeader.replace("Bearer ", "");

  if (!CLERK_SECRET_KEY) {
    console.warn("[Clerk] CLERK_SECRET_KEY not set — treating as anonymous");
    c.set("userId", null);
    await next();
    return;
  }

  try {
    const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
    c.set("userId", payload.sub ?? null);
  } catch (err) {
    console.warn("[Clerk] Token verification failed:", err);
    c.set("userId", null);
  }

  await next();
}

export function requireAuth(c: Context): string | null {
  return c.get("userId");
}
