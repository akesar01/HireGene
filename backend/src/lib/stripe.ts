import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!stripeSecretKey) {
    console.warn("[Stripe] STRIPE_SECRET_KEY not set — billing features unavailable");
    return null;
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(stripeSecretKey);
  }
  return stripeInstance;
}

export const STRIPE_PLANS = {
  early_access: {
    name: "Early Access",
    priceId: process.env.STRIPE_PRICE_EARLY_ACCESS ?? "",
    description: "See jobs 24h before everyone else",
  },
  ai_outreach: {
    name: "AI Outreach",
    priceId: process.env.STRIPE_PRICE_AI_OUTREACH ?? "",
    description: "Generate personalized DMs to hiring managers",
  },
  pro: {
    name: "Pro",
    priceId: process.env.STRIPE_PRICE_PRO ?? "",
    description: "Early Access + AI Outreach + unlimited match scores",
  },
} as const;

export type PlanId = keyof typeof STRIPE_PLANS;
