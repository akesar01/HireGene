// Public email endpoints: per-user preferences (Clerk), one-click
// unsubscribe (signed token, no login) and the Resend webhook (Svix-signed).

import { Hono } from "hono";
import type { Context } from "hono";
import { Prisma } from "@prisma/client";
import { Webhook } from "svix";
import { verifyUnsubscribeToken } from "../lib/email-tokens.js";
import { getOrCreatePreference } from "../lib/nudge-send.js";
import { prisma } from "../lib/prisma.js";
import { frontendUrl } from "../lib/site-urls.js";

type Variables = { userId: string | null };

const email = new Hono<{ Variables: Variables }>();

// ─── Preferences ─────────────────────────────────────────────────────────────

email.get("/preferences", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "Authentication required" }, 401);
  const pref = await prisma.emailPreference.findUnique({ where: { userId } });
  return c.json({
    preferences: {
      subscribed: pref?.subscribed ?? true,
      frequency: pref?.frequency ?? "weekly",
      pausedUntil: pref?.pausedUntil?.toISOString() ?? null,
      unsubscribedAt: pref?.unsubscribedAt?.toISOString() ?? null,
      lastSentAt: pref?.lastSentAt?.toISOString() ?? null,
      isDefault: !pref,
    },
  });
});

email.put("/preferences", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "Authentication required" }, 401);

  let body: { subscribed?: unknown; frequency?: unknown; pausedUntil?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const data: Prisma.EmailPreferenceUpdateInput = {};
  if (typeof body.subscribed === "boolean") {
    data.subscribed = body.subscribed;
    data.unsubscribedAt = body.subscribed ? null : new Date();
    data.unsubscribeReason = body.subscribed ? null : "user";
  }
  if (body.frequency !== undefined) {
    if (body.frequency !== "weekly" && body.frequency !== "daily") {
      return c.json({ error: "frequency must be weekly or daily" }, 400);
    }
    data.frequency = body.frequency;
  }
  if (body.pausedUntil !== undefined) {
    if (body.pausedUntil === null) {
      data.pausedUntil = null;
    } else {
      const date = new Date(String(body.pausedUntil));
      if (Number.isNaN(date.getTime())) return c.json({ error: "pausedUntil must be an ISO date or null" }, 400);
      data.pausedUntil = date;
    }
  }

  await getOrCreatePreference(userId);
  const pref = await prisma.emailPreference.update({ where: { userId }, data });
  return c.json({
    preferences: {
      subscribed: pref.subscribed,
      frequency: pref.frequency,
      pausedUntil: pref.pausedUntil?.toISOString() ?? null,
      unsubscribedAt: pref.unsubscribedAt?.toISOString() ?? null,
      lastSentAt: pref.lastSentAt?.toISOString() ?? null,
      isDefault: false,
    },
  });
});

// ─── One-click unsubscribe ───────────────────────────────────────────────────

function maskEmail(value: string | null): string | null {
  if (!value) return null;
  const [local, domain] = value.split("@");
  if (!domain) return null;
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${"*".repeat(Math.max(1, local.length - head.length))}@${domain}`;
}

async function handleUnsubscribe(c: Context) {
  const signed = c.req.query("t") ?? "";
  const storedToken = signed ? verifyUnsubscribeToken(signed) : null;
  if (!storedToken) return c.json({ error: "Invalid or expired link" }, 400);

  const pref = await prisma.emailPreference.findUnique({ where: { unsubscribeToken: storedToken } });
  if (!pref) return c.json({ error: "Invalid or expired link" }, 400);

  const resubscribe = c.req.query("action") === "resubscribe";
  const now = new Date();
  const updated = await prisma.emailPreference.update({
    where: { id: pref.id },
    data: resubscribe
      ? { subscribed: true, unsubscribedAt: null, unsubscribeReason: null, pausedUntil: null }
      : { subscribed: false, unsubscribedAt: pref.unsubscribedAt ?? now, unsubscribeReason: pref.unsubscribeReason ?? "user" },
  });
  if (!resubscribe) {
    const latest = await prisma.nudgeSend.findFirst({
      where: { userId: pref.userId, status: { in: ["sent", "delivered"] } },
      orderBy: { sentAt: "desc" },
      select: { id: true, unsubscribedAt: true },
    });
    if (latest && !latest.unsubscribedAt) {
      await prisma.nudgeSend.update({ where: { id: latest.id }, data: { unsubscribedAt: now } });
    }
  }
  return c.json({ ok: true, subscribed: updated.subscribed, email: maskEmail(updated.email) });
}

// A bare GET (link scanners, mail-client previews) only lands on the confirm
// page; the page's button and the RFC 8058 POST below are what unsubscribe.
email.get("/unsubscribe", (c) => {
  const signed = c.req.query("t");
  const target = `${frontendUrl()}/unsubscribe${signed ? `?t=${encodeURIComponent(signed)}` : ""}`;
  c.header("Cache-Control", "no-store");
  return c.redirect(target, 302);
});
// RFC 8058: mail clients POST `List-Unsubscribe=One-Click` to this URL.
email.post("/unsubscribe", handleUnsubscribe);

// ─── Resend webhook ──────────────────────────────────────────────────────────

export interface ResendWebhookEvent {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    subject?: string;
    click?: { link?: string; timestamp?: string };
    bounce?: { type?: string; subType?: string; message?: string };
  };
}

/** Parse /go/<sendId>/<jobId> out of a clicked link, if that is what it was. */
export function jobIdFromGoLink(link: string | undefined): number | null {
  if (!link) return null;
  const match = /\/go\/[^/]+\/(\d+)(?:[/?#]|$)/.exec(link);
  return match ? Number(match[1]) : null;
}

export async function applyWebhookEvent(event: ResendWebhookEvent, now = new Date()): Promise<string> {
  const messageId = event.data?.email_id;
  if (!messageId) return "ignored: no email_id";
  const send = await prisma.nudgeSend.findUnique({ where: { providerMessageId: messageId } });
  if (!send) return "ignored: unknown message";

  const terminal = send.status === "bounced" || send.status === "complained";
  switch (event.type) {
    case "email.delivered":
      await prisma.nudgeSend.update({
        where: { id: send.id },
        data: { deliveredAt: send.deliveredAt ?? now, ...(terminal ? {} : { status: "delivered" }) },
      });
      return "delivered";
    case "email.opened":
      await prisma.nudgeSend.update({ where: { id: send.id }, data: { openedAt: send.openedAt ?? now } });
      return "opened";
    case "email.clicked": {
      const link = event.data?.click?.link;
      await prisma.$transaction([
        prisma.nudgeSend.update({ where: { id: send.id }, data: { clickedAt: send.clickedAt ?? now } }),
        prisma.nudgeClick.create({
          data: { sendId: send.id, jobId: jobIdFromGoLink(link), source: "webhook", url: link?.slice(0, 2000) ?? null },
        }),
      ]);
      return "clicked";
    }
    case "email.bounced": {
      const hard = (event.data?.bounce?.type ?? "").toLowerCase() === "permanent";
      await prisma.nudgeSend.update({
        where: { id: send.id },
        data: { bouncedAt: send.bouncedAt ?? now, status: "bounced" },
      });
      if (hard) {
        await prisma.emailPreference.updateMany({
          where: { userId: send.userId, subscribed: true },
          data: { subscribed: false, unsubscribedAt: now, unsubscribeReason: "bounce" },
        });
        return "bounced: hard, unsubscribed";
      }
      return "bounced: soft";
    }
    case "email.complained":
      await prisma.$transaction([
        prisma.nudgeSend.update({
          where: { id: send.id },
          data: { complainedAt: send.complainedAt ?? now, unsubscribedAt: send.unsubscribedAt ?? now, status: "complained" },
        }),
        prisma.emailPreference.updateMany({
          where: { userId: send.userId, subscribed: true },
          data: { subscribed: false, unsubscribedAt: now, unsubscribeReason: "complaint" },
        }),
      ]);
      return "complained: unsubscribed";
    default:
      return `ignored: ${event.type}`;
  }
}

email.post("/webhook", async (c) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: "Webhook not configured" }, 503);

  const svixId = c.req.header("svix-id");
  const svixTimestamp = c.req.header("svix-timestamp");
  const svixSignature = c.req.header("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: "Missing signature headers" }, 400);
  }

  const rawBody = await c.req.text();
  try {
    new Webhook(secret).verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err) {
    console.warn("[email] webhook signature rejected:", err instanceof Error ? err.message : err);
    return c.json({ error: "Invalid signature" }, 400);
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(rawBody) as ResendWebhookEvent;
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!event || typeof event.type !== "string") return c.json({ error: "Invalid event" }, 400);

  try {
    await prisma.emailEvent.create({
      data: {
        providerEventId: svixId,
        type: event.type,
        messageId: event.data?.email_id ?? null,
        payload: event as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return c.json({ received: true, duplicate: true });
    }
    throw err;
  }

  const outcome = await applyWebhookEvent(event);
  return c.json({ received: true, outcome });
});

export default email;
