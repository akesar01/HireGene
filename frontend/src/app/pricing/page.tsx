"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Header from "@/components/Header";
import { createCheckoutSession } from "@/lib/billing";

const PLANS = [
  {
    id: "early_access",
    name: "Early Access",
    price: "₹99",
    period: "/mo",
    description: "See jobs 24h before everyone else",
    features: [
      "Early access to all new job posts",
      "Be first to DM the hiring manager",
      "Beat the competition by 24 hours",
    ],
    highlight: false,
  },
  {
    id: "ai_outreach",
    name: "AI Outreach",
    price: "₹199",
    period: "/mo",
    description: "Generate personalized DMs to hiring managers",
    features: [
      "One-click AI-generated outreach messages",
      "Tailored to your resume + the job post",
      "20 messages per day",
      "Copy-paste ready for LinkedIn & email",
    ],
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹299",
    period: "/mo",
    description: "Everything in Early Access + AI Outreach",
    features: [
      "Early access to all job posts",
      "Unlimited AI outreach messages",
      "Unlimited AI match scores",
      "Priority support",
    ],
    highlight: false,
  },
];

export default function PricingPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    if (!isSignedIn) {
      window.location.href = "/sign-in?redirect_url=/pricing";
      return;
    }
    setLoading(planId);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const url = await createCheckoutSession(token, planId);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Upgrade your job search
          </h1>
          <p className="mt-3 text-muted text-base max-w-xl mx-auto">
            Real jobs from real hiring managers. Upgrade to get ahead of the competition.
          </p>
        </div>

        {error && (
          <div className="mb-6 max-w-md mx-auto bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-card-bg border rounded-xl p-6 shadow-card flex flex-col ${
                plan.highlight
                  ? "border-accent ring-1 ring-accent/30"
                  : "border-card-border"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full">
                  Most popular
                </div>
              )}
              <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
              <p className="text-sm text-muted mt-1">{plan.description}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                <span className="text-sm text-muted">{plan.period}</span>
              </div>
              <ul className="mt-6 space-y-3 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-muted">
                    <svg className="w-4 h-4 text-accent shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={loading === plan.id}
                className={`mt-6 w-full text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50 ${
                  plan.highlight
                    ? "bg-accent text-white hover:bg-accent-hover"
                    : "bg-surface text-foreground border border-card-border hover:border-border"
                }`}
              >
                {loading === plan.id ? "Redirecting..." : isSignedIn ? "Upgrade" : "Sign in to upgrade"}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted">
          Cancel anytime. Secure payment via Stripe.
        </p>
      </div>
    </div>
  );
}
