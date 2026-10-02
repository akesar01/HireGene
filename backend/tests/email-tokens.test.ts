import { describe, expect, it } from "vitest";
import {
  newUnsubscribeToken,
  signToken,
  signUnsubscribeToken,
  verifyToken,
  verifyUnsubscribeToken,
} from "../src/lib/email-tokens";

const SECRET = "test-secret";

describe("signed tokens", () => {
  it("round-trips a payload", () => {
    const token = signToken("user_123", SECRET);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(verifyToken(token, SECRET)).toBe("user_123");
  });

  it("rejects a tampered payload, a tampered signature and the wrong secret", () => {
    const token = signToken("user_123", SECRET);
    const [payload, signature] = token.split(".");
    const otherPayload = Buffer.from("user_999").toString("base64url");
    expect(verifyToken(`${otherPayload}.${signature}`, SECRET)).toBeNull();
    expect(verifyToken(`${payload}.${signature.slice(0, -1)}x`, SECRET)).toBeNull();
    expect(verifyToken(token, "another-secret")).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifyToken("", SECRET)).toBeNull();
    expect(verifyToken("no-dot", SECRET)).toBeNull();
    expect(verifyToken(".sig", SECRET)).toBeNull();
    expect(verifyToken("a.b.c!", SECRET)).toBeNull();
    expect(verifyToken(undefined as unknown as string, SECRET)).toBeNull();
  });

  it("signs the stored unsubscribe token with UNSUBSCRIBE_SECRET", () => {
    const env = { UNSUBSCRIBE_SECRET: "prod-secret" } as NodeJS.ProcessEnv;
    const stored = newUnsubscribeToken();
    expect(stored).toHaveLength(24);
    const signed = signUnsubscribeToken(stored, env);
    expect(verifyUnsubscribeToken(signed, env)).toBe(stored);
    expect(verifyUnsubscribeToken(signed, { UNSUBSCRIBE_SECRET: "other" } as NodeJS.ProcessEnv)).toBeNull();
  });
});
