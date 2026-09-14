import { describe, expect, it } from "vitest";
import {
  DEFAULT_GROQ_MODELS,
  groqApiKey,
  groqModelCandidates,
  isGroqModelUnavailable,
} from "../src/lib/groq";

describe("groqModelCandidates", () => {
  it("defaults to Groq's llama-3.3 replacements", () => {
    expect(groqModelCandidates({})).toEqual([...DEFAULT_GROQ_MODELS]);
    expect(groqModelCandidates({})[0]).toBe("openai/gpt-oss-120b");
  });

  it("puts GROQ_MODEL first and still falls back to replacements", () => {
    expect(groqModelCandidates({ GROQ_MODEL: "llama-3.3-70b-versatile" })).toEqual([
      "llama-3.3-70b-versatile",
      "openai/gpt-oss-120b",
      "qwen/qwen3.6-27b",
    ]);
  });

  it("dedupes when GROQ_MODEL is already a default", () => {
    expect(groqModelCandidates({ GROQ_MODEL: "openai/gpt-oss-120b" })).toEqual([
      "openai/gpt-oss-120b",
      "qwen/qwen3.6-27b",
    ]);
  });
});

describe("isGroqModelUnavailable", () => {
  it("detects the production 404 that llama-3.3-70b-versatile now returns", () => {
    const body =
      '{"error":{"message":"The model `llama-3.3-70b-versatile` does not exist or you do not have access to it.","type":"invalid_request_error","code":"model_not_found"}}';
    expect(isGroqModelUnavailable(404, body)).toBe(true);
    expect(isGroqModelUnavailable(400, body)).toBe(false);
    expect(isGroqModelUnavailable(404, '{"error":"rate limited"}')).toBe(false);
  });
});

describe("groqApiKey", () => {
  it("ignores blank keys", () => {
    expect(groqApiKey({})).toBeUndefined();
    expect(groqApiKey({ GROQ_API_KEY: "  " })).toBeUndefined();
    expect(groqApiKey({ GROQ_API_KEY: "gsk_test" })).toBe("gsk_test");
  });
});
