import { BACKEND_URL } from "./config";

export interface BillingStatus {
  is_pro: boolean;
  plan: string | null;
  pro_until: string | null;
}

export async function getBillingStatus(token: string): Promise<BillingStatus> {
  const res = await fetch(`${BACKEND_URL}/api/billing/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return { is_pro: false, plan: null, pro_until: null };
  }
  return res.json();
}

export async function createCheckoutSession(token: string, plan: string): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/billing/checkout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to start checkout");
  }
  const data = await res.json();
  return data.url;
}
