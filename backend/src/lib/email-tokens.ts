// Signed, stateless tokens for unsubscribe links. HMAC-SHA256 over the
// payload; verification is constant-time. No login, no database lookup
// needed to reject a forged link.

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const FALLBACK_WARNING = "[email] UNSUBSCRIBE_SECRET not set; using a development fallback. Set it in production.";
let warned = false;

export function unsubscribeSecret(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.UNSUBSCRIBE_SECRET?.trim();
  if (explicit) return explicit;
  if (!warned) {
    warned = true;
    console.warn(FALLBACK_WARNING);
  }
  return env.CRON_SECRET?.trim() || "dev-unsubscribe-secret";
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function hmac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** `base64url(payload).signature` */
export function signToken(payload: string, secret: string): string {
  const encoded = b64url(payload);
  return `${encoded}.${hmac(encoded, secret)}`;
}

/** The payload when the signature is valid, else null. */
export function verifyToken(token: string, secret: string): string | null {
  if (typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;
  const expected = hmac(encoded, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

/** Random per-user token stored on the preference row; the link carries its signature. */
export function newUnsubscribeToken(): string {
  return randomBytes(18).toString("base64url");
}

export function signUnsubscribeToken(storedToken: string, env: NodeJS.ProcessEnv = process.env): string {
  return signToken(storedToken, unsubscribeSecret(env));
}

export function verifyUnsubscribeToken(signed: string, env: NodeJS.ProcessEnv = process.env): string | null {
  return verifyToken(signed, unsubscribeSecret(env));
}
