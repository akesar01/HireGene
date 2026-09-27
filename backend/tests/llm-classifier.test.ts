import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const groqChatContent = vi.fn<(...args: unknown[]) => Promise<string | null>>();
const groqApiKey = vi.fn<() => string | undefined>();

vi.mock("../src/lib/groq", () => ({
  groqChatContent: (...args: unknown[]) => groqChatContent(...args),
  groqApiKey: () => groqApiKey(),
}));

import { classifyPost } from "../src/lib/llm-classifier";

const AMAZON_HEADLINE =
  "Recruiter II - Science | Hiring Applied Scientists/Research Scientists/Data Scientists for Amazon";

describe("classifyPost with Groq mocked", () => {
  beforeEach(() => {
    groqApiKey.mockReturnValue("test-key");
    groqChatContent.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("never calls Groq more than once per post", async () => {
    groqChatContent.mockResolvedValue(
      JSON.stringify({
        isJobPost: true,
        title: "Staff Software Engineer (Backend)",
        roleFamily: "engineering",
        seniority: "staff",
        remoteMode: "hybrid",
        techStack: ["java"],
        description: ["Build the platform"],
      }),
    );
    const result = await classifyPost("We're hiring a Staff Software Engineer (Backend) at Databricks.", "Staff Recruiter at Databricks");
    expect(result.isJobPost).toBe(true);
    expect(result.title).toBe("Staff Software Engineer (Backend)");
    expect(groqChatContent).toHaveBeenCalledTimes(1);
  });

  it("turns isJobPost true with an empty title into not a job when the post has no title either", async () => {
    groqChatContent.mockResolvedValue(
      JSON.stringify({
        isJobPost: true,
        title: "",
        roleFamily: "ai_ml",
        seniority: "mid",
        remoteMode: "in_office",
        techStack: [],
        description: [],
      }),
    );
    const result = await classifyPost(
      "Exciting opportunities across Amazon science teams. Reach out to learn more!",
      AMAZON_HEADLINE,
    );
    expect(result.isJobPost).toBe(false);
    expect(result.title).toBe("");
  });

  it("recovers a concrete title from the post text when the model leaves it blank", async () => {
    groqChatContent.mockResolvedValue(
      JSON.stringify({
        isJobPost: true,
        title: "",
        roleFamily: "engineering",
        seniority: "senior",
        remoteMode: "in_office",
        techStack: [],
        description: [],
      }),
    );
    const result = await classifyPost("We're hiring a Senior Backend Engineer\nCome build with us.", "EM @ Razorpay");
    expect(result.isJobPost).toBe(true);
    expect(result.title).toBe("Senior Backend Engineer");
  });

  it("does not let the regex override a model 'not a job' unless it can name a title", async () => {
    groqChatContent.mockResolvedValue(
      JSON.stringify({
        isJobPost: false,
        title: "",
        roleFamily: "engineering",
        seniority: "mid",
        remoteMode: "in_office",
        techStack: [],
        description: [],
      }),
    );
    const noTitle = await classifyPost("My team is hiring. Need someone with Python skills.", "");
    expect(noTitle.isJobPost).toBe(false);

    const withTitle = await classifyPost("We're hiring a Senior Backend Engineer to join our team", "");
    expect(withTitle.isJobPost).toBe(true);
    expect(withTitle.title).toBe("Senior Backend Engineer");
  });

  it("does not recover a sentence fragment as the title when the model leaves it blank", async () => {
    const blankTitle = JSON.stringify({
      isJobPost: true,
      title: "",
      roleFamily: "engineering",
      seniority: "mid",
      remoteMode: "in_office",
      techStack: [],
      description: [],
    });
    for (const text of [
      "We're hiring for our Bengaluru office, all levels welcome. DM me.",
      "Currently hiring across multiple teams, ping me",
    ]) {
      groqChatContent.mockResolvedValue(blankTitle);
      const result = await classifyPost(text, "Talent Partner");
      expect(result.isJobPost).toBe(false);
      expect(result.title).toBe("");
    }
  });

  it("tells the model never to return isJobPost true with an empty title", async () => {
    groqChatContent.mockResolvedValue(null);
    await classifyPost("We're hiring a Senior Backend Engineer", "");
    const call = groqChatContent.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
    const system = call.messages.find((m) => m.role === "system")?.content ?? "";
    expect(system).toMatch(/never return isJobPost true with an empty title/i);
  });
});

describe("classifyPost regex fallback without a Groq key", () => {
  beforeEach(() => {
    groqApiKey.mockReturnValue(undefined);
    groqChatContent.mockReset();
  });

  it("requires a concrete title, never calling Groq", async () => {
    const noTitle = await classifyPost("My team is hiring. Need someone with Python skills.");
    expect(noTitle.isJobPost).toBe(false);

    const withTitle = await classifyPost("We're hiring a Senior Backend Engineer to join our team at Razorpay!");
    expect(withTitle.isJobPost).toBe(true);
    expect(withTitle.title).toBe("Senior Backend Engineer");
    expect(groqChatContent).not.toHaveBeenCalled();
  });

  it("rejects hiring sentences that never name a role", async () => {
    for (const text of [
      "We're hiring for our Bengaluru office, all levels welcome. DM me.",
      "Currently hiring across multiple teams, ping me",
    ]) {
      const result = await classifyPost(text);
      expect(result.isJobPost).toBe(false);
      expect(result.title).toBe("");
    }
    expect(groqChatContent).not.toHaveBeenCalled();
  });
});
