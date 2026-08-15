import { Hono } from "hono";
import { getStripe, STRIPE_PLANS, type PlanId } from "../lib/stripe.js";
import { getProfilesCollection } from "../lib/mongo.js";

type Variables = {
  userId: string | null;
};

const billingRoutes = new Hono<{ Variables: Variables }>();

// ─── Create checkout session ────────────────────────────────────────────────
billingRoutes.post("/checkout", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "Authentication required" }, 401);

  const stripe = getStripe();
  if (!stripe) return c.json({ error: "Billing not configured" }, 503);

  const body = await c.req.json().catch(() => ({})) as { plan?: string };
  const planId = body.plan as PlanId | undefined;
  const plan = planId ? STRIPE_PLANS[planId] : undefined;

  if (!plan || !plan.priceId) {
    return c.json({ error: "Invalid or missing plan" }, 400);
  }

  const origin = process.env.FRONTEND_URL ?? "https://skiptheboard.in";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${origin}/profile?upgrade=success`,
      cancel_url: `${origin}/profile?upgrade=cancelled`,
      client_reference_id: userId,
      metadata: { userId, plan: planId ?? "pro" },
    });

    return c.json({ url: session.url });
  } catch (err) {
    console.error("[Billing] Checkout error:", err);
    return c.json({ error: "Failed to create checkout session" }, 500);
  }
});

// ─── Get billing status ─────────────────────────────────────────────────────
billingRoutes.get("/status", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ is_pro: false, plan: null }, 401);

  const profiles = await getProfilesCollection();
  if (!profiles) return c.json({ is_pro: false, plan: null });

  const profile = await profiles.findOne({ _id: userId } as any);
  const now = new Date();
  const isPro = !!(profile?.pro_until && new Date(profile.pro_until) > now);

  return c.json({
    is_pro: isPro,
    plan: profile?.plan ?? null,
    pro_until: profile?.pro_until ?? null,
  });
});

// ─── Stripe webhook ─────────────────────────────────────────────────────────
billingRoutes.post("/webhook", async (c) => {
  const stripe = getStripe();
  if (!stripe) return c.json({ error: "Billing not configured" }, 503);

  const sig = c.req.header("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return c.json({ error: "Missing signature" }, 400);
  }

  const rawBody = await c.req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[Billing] Webhook signature verification failed:", err);
    return c.json({ error: "Invalid signature" }, 400);
  }

  const profiles = await getProfilesCollection();
  if (!profiles) return c.json({ received: true });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.client_reference_id ?? session.metadata?.userId;
      const plan = session.metadata?.plan ?? "pro";
      if (userId) {
        await profiles.updateOne(
          { _id: userId } as any,
          { $set: { is_pro: true, plan, pro_since: new Date() } },
          { upsert: true },
        );
      }
      break;
    }

    case "customer.subscription.deleted":
    case "customer.subscription.paused": {
      const subscription = event.data.object;
      const userId = subscription.metadata?.userId;
      if (userId) {
        await profiles.updateOne(
          { _id: userId } as any,
          { $set: { is_pro: false, plan: null, pro_until: new Date() } },
        );
      }
      break;
    }

    default:
      break;
  }

  return c.json({ received: true });
});

export default billingRoutes;
