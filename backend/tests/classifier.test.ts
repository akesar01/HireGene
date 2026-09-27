import { describe, it, expect } from "vitest";
import {
  isJobPost,
  extractExplicitTitle,
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

  it("rejects hashtag-only hiring commentary", () => {
    expect(
      isJobPost(
        "The Indian tech market is shifting fast.\n\nDo you agree?\n\n#india #hiring #techcareers #jobsearch",
      ),
    ).toBe(false);
  });

  it("rejects job-market rants that mention hiring but are not openings", () => {
    const text = `
Nobody hiring for "5 years of LLM experience" has 5 years of LLM experience.

Not the recruiter.
Not the hiring manager who signed off on it.

ChatGPT went public in November 2022. That's three years and eight months.
The job post wants five.

The bar is real. The wording is broken.

Do you agree?

Joshua Talreja
#india #hiring #techcareers #jobsearch
`;
    expect(isJobPost(text)).toBe(false);
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

describe("extractExplicitTitle", () => {
  it("stops the capture before connective clauses and punctuation", () => {
    expect(extractExplicitTitle("We're hiring a Senior Backend Engineer to join our team")).toBe("Senior Backend Engineer");
    expect(extractExplicitTitle("We're hiring a Senior Backend Engineer\nCome build with us.")).toBe("Senior Backend Engineer");
    expect(extractExplicitTitle("Hiring Software Engineer III for our Bengaluru office. DM me.")).toBe("Software Engineer III");
    expect(extractExplicitTitle("We're hiring for a Data Scientist, apply now!")).toBe("Data Scientist");
    expect(extractExplicitTitle("Looking for an ML Engineer (Bengaluru) with LLM experience")).toBe("ML Engineer");
  });

  it("reads the role out of a 'Hiring | Role | Company' header", () => {
    expect(extractExplicitTitle("We're Hiring | SDET III – Performance Testing | Baazi Games")).toBe(
      "SDET III – Performance Testing",
    );
    expect(extractExplicitTitle("Hiring: Senior Backend Engineer at Zepto")).toBe("Senior Backend Engineer");
  });

  it("accepts the wider role vocabulary", () => {
    expect(extractExplicitTitle("We're hiring an SRE to run our platform")).toBe("SRE");
    expect(extractExplicitTitle("We're hiring a Head of Engineering for Bengaluru")).toBe("Head of Engineering");
    expect(extractExplicitTitle("Looking for a Director of Engineering, Payments")).toBe("Director of Engineering");
    expect(extractExplicitTitle("Hiring Embedded Programmers for our Pune lab")).toBe("Embedded Programmers");
  });

  it("returns nothing for hiring sentences that never name a role", () => {
    expect(extractExplicitTitle("We're hiring for our Bengaluru office, all levels welcome. DM me.")).toBe("");
    expect(extractExplicitTitle("Currently hiring across multiple teams, ping me")).toBe("");
    expect(extractExplicitTitle("We're hiring! Join us at Zepto.")).toBe("");
    expect(extractExplicitTitle("My team is hiring. Need someone with Python skills.")).toBe("");
  });

  it("returns nothing when the only role word is a lone lowercase noun", () => {
    expect(
      extractExplicitTitle(
        "Every startup is hiring engineers with 10 years of React experience. React is only 12 years old. Know someone who feels this?",
      ),
    ).toBe("");
    expect(extractExplicitTitle("We are hiring developers, apply now")).toBe("");
  });
});

describe("extractTitle", () => {
  it("extracts title from 'hiring X' pattern", () => {
    expect(extractTitle("We're hiring a Senior Backend Engineer to join our team")).toBe("Senior Backend Engineer");
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
