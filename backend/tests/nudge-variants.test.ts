import { describe, expect, it } from "vitest";
import { assignVariant, bucketFor, validateVariants } from "../src/lib/nudge-variants";

describe("variant assignment", () => {
  const arms = [
    { id: 1, key: "A", weight: 45, isHoldout: false },
    { id: 2, key: "B", weight: 45, isHoldout: false },
    { id: 3, key: "control", weight: 10, isHoldout: true },
  ];

  it("is deterministic per campaign and user", () => {
    expect(bucketFor(7, "user_1")).toBe(bucketFor(7, "user_1"));
    expect(bucketFor(7, "user_1")).not.toBe(bucketFor(8, "user_1"));
    const b = bucketFor(7, "user_1");
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(100);
  });

  it("splits users roughly by weight, including the holdout", () => {
    const counts: Record<string, number> = { A: 0, B: 0, control: 0 };
    const total = 20_000;
    for (let i = 0; i < total; i += 1) {
      const arm = assignVariant(arms, bucketFor(42, `user_${i}`))!;
      counts[arm.key] += 1;
    }
    expect(counts.A / total).toBeGreaterThan(0.42);
    expect(counts.A / total).toBeLessThan(0.48);
    expect(counts.B / total).toBeGreaterThan(0.42);
    expect(counts.B / total).toBeLessThan(0.48);
    expect(counts.control / total).toBeGreaterThan(0.08);
    expect(counts.control / total).toBeLessThan(0.12);
  });

  it("maps bucket edges onto cumulative ranges", () => {
    expect(assignVariant(arms, 0)!.key).toBe("A");
    expect(assignVariant(arms, 44.99)!.key).toBe("A");
    expect(assignVariant(arms, 45)!.key).toBe("B");
    expect(assignVariant(arms, 89.99)!.key).toBe("B");
    expect(assignVariant(arms, 90)!.key).toBe("control");
    expect(assignVariant(arms, 99.99)!.key).toBe("control");
    expect(assignVariant([], 10)).toBeNull();
  });

  it("validates weights", () => {
    expect(validateVariants(arms)).toBeNull();
    expect(validateVariants([{ key: "A", weight: 60, isHoldout: false }, { key: "B", weight: 60, isHoldout: false }])).toMatch(/sum to 100/);
    expect(validateVariants([{ key: "A", weight: 50, isHoldout: false }, { key: "A", weight: 50, isHoldout: false }])).toMatch(/duplicate/);
    expect(validateVariants([{ key: "A", weight: 100, isHoldout: true }])).toMatch(/must send/);
    expect(validateVariants([{ key: "A", weight: 50.5, isHoldout: false }, { key: "B", weight: 49.5, isHoldout: false }])).toMatch(/integer/);
    expect(validateVariants([])).toMatch(/at least one/);
  });
});
