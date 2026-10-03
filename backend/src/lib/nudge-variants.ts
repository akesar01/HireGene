// Deterministic experiment assignment. The same user always lands in the
// same arm of the same campaign, so a re-run never flips anyone.

import { createHash } from "crypto";

export interface VariantArm {
  key: string;
  weight: number;
  isHoldout: boolean;
}

/** Bucket in [0, 100) with two decimals of resolution, derived from campaign + user. */
export function bucketFor(campaignId: number, userId: string): number {
  const digest = createHash("sha256").update(`${campaignId}:${userId}`).digest();
  const value = digest.readUInt32BE(0);
  return (value % 10_000) / 100;
}

/** Null when weights are valid; otherwise a human-readable reason. */
export function validateVariants(variants: VariantArm[]): string | null {
  if (variants.length === 0) return "at least one variant is required";
  const keys = new Set<string>();
  let total = 0;
  for (const v of variants) {
    if (!v.key || !v.key.trim()) return "every variant needs a key";
    if (keys.has(v.key)) return `duplicate variant key "${v.key}"`;
    keys.add(v.key);
    if (!Number.isInteger(v.weight) || v.weight < 0 || v.weight > 100) {
      return `variant "${v.key}" weight must be an integer between 0 and 100`;
    }
    total += v.weight;
  }
  if (total !== 100) return `variant weights must sum to 100 (got ${total})`;
  if (variants.every((v) => v.isHoldout)) return "at least one variant must send email";
  return null;
}

/** Pick the arm whose cumulative weight range contains the bucket. */
export function assignVariant<T extends { weight: number }>(variants: T[], bucket: number): T | null {
  if (variants.length === 0) return null;
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.weight;
    if (bucket < cumulative) return variant;
  }
  return variants[variants.length - 1];
}
