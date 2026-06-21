import { describe, it, expect } from "vitest";
import {
  isJobPost,
  extractTitle,
  extractRoleFamily,
  extractSeniority,
  extractRemoteMode,
  extractTechStack,
  extractDescription,
} from "../src/lib/classifier";

describe("isJobPost", () => {
  it("detects 'we're hiring' posts", () => {
    expect(isJobPost("We're hiring a Senior Backend Engineer to join our team at Razorpay!")).toBe(true);
  });

  it("detects 'my team is hiring' posts", () => {
    expect(isJobPost("My team is hiring an ML Engineer. DM me if interested.")).toBe(true);
  });

  it("detects 'actively hiring' posts", () => {
    expect(isJobPost("Actively hiring for a Product Manager role.")).toBe(true);
  });

  it("rejects 'I was hired' posts", () => {
    expect(isJobPost("I was hired at Google last week, so excited!")).toBe(false);
  });

  it("rejects short text", () => {
    expect(isJobPost("Hiring!")).toBe(false);
  });

  it("returns false for non-hiring posts", () => {
    expect(isJobPost("Just attended a great conference on AI and machine learning.")).toBe(false);
  });
});

describe("extractSeniority", () => {
  it("detects senior", () => {
    expect(extractSeniority("Looking for a Senior Engineer")).toBe("senior");
  });

  it("detects intern", () => {
    expect(extractSeniority("Hiring a data analyst intern")).toBe("intern");
  });

  it("defaults to mid", () => {
    expect(extractSeniority("Looking for an engineer")).toBe("mid");
  });
});

describe("extractRemoteMode", () => {
  it("detects remote", () => {
    expect(extractRemoteMode("This is a remote position")).toBe("remote");
  });

  it("detects hybrid", () => {
    expect(extractRemoteMode("Hybrid role, 3 days in office")).toBe("hybrid");
  });

  it("defaults to in_office", () => {
    expect(extractRemoteMode("Looking for an engineer")).toBe("in_office");
  });
});

describe("extractRoleFamily", () => {
  it("detects engineering", () => {
    expect(extractRoleFamily("Hiring a backend engineer")).toBe("engineering");
  });

  it("detects ai_ml", () => {
    expect(extractRoleFamily("Looking for an ML engineer with LLM experience")).toBe("ai_ml");
  });

  it("detects product", () => {
    expect(extractRoleFamily("Hiring a Product Manager")).toBe("product");
  });

  it("defaults to engineering", () => {
    expect(extractRoleFamily("Looking for someone to join our team")).toBe("engineering");
  });
});

describe("extractTechStack", () => {
  it("detects multiple stacks", () => {
    const stacks = extractTechStack("Need Python and SQL skills, experience with AWS");
    expect(stacks).toContain("python");
    expect(stacks).toContain("sql");
    expect(stacks).toContain("aws");
  });

  it("returns empty for no matches", () => {
    expect(extractTechStack("Looking for a great engineer")).toEqual([]);
  });
});

describe("extractTitle", () => {
  it("extracts title from 'hiring X' pattern", () => {
    expect(extractTitle("We're hiring a Senior Backend Engineer to join our team")).toBe("Senior Backend Engineer to join our team");
  });

  it("falls back to role family + seniority", () => {
    expect(extractTitle("My team is hiring. Need someone with Python skills.")).toBe("Software Engineer");
  });
});

describe("extractDescription", () => {
  it("extracts bullet-like lines", () => {
    const text = "We're hiring!\nStrong C/C++ development skills\nExperience with RDBMS kernels\nDM me if interested";
    const desc = extractDescription(text);
    expect(desc).toHaveLength(3);
    expect(desc[0]).toContain("Strong C/C++");
  });

  it("filters out short lines", () => {
    const text = "Hiring\nOK\nThis is a longer line that should be included in the output";
    const desc = extractDescription(text);
    expect(desc).toHaveLength(1);
  });
});
