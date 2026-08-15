import { describe, expect, it } from "vitest";
import {
  extractCompanyFromHeadline,
  extractCompanyFromPost,
  inferCompany,
} from "../src/lib/extract-company";

describe("extractCompanyFromHeadline", () => {
  it("reads @ Company", () => {
    expect(extractCompanyFromHeadline("SWE @ Google")).toBe("Google");
  });

  it("reads a pipe company like Walmart Global Tech India", () => {
    expect(
      extractCompanyFromHeadline(
        "Talent Acquisition Specialist | Walmart Global Tech India | Hiring Top Notch Talent",
      ),
    ).toBe("Walmart Global Tech India");
  });

  it("returns null for a generic TA headline", () => {
    expect(
      extractCompanyFromHeadline(
        "Talent Acquisition | Campus & Lateral Hiring | Tech Recruitment",
      ),
    ).toBeNull();
  });
});

describe("extractCompanyFromPost", () => {
  it("reads Company is hiring", () => {
    expect(extractCompanyFromPost("SkillPad is Hiring! Senior Manager")).toBe("SkillPad");
    expect(extractCompanyFromPost("Tekion Corp is hiring engineers")).toBe("Tekion Corp");
  });

  it("reads at Company", () => {
    expect(extractCompanyFromPost("We are hiring a Staff Software Engineer at Walmart Global Tech India for #Chennai")).toBe(
      "Walmart Global Tech India",
    );
    expect(extractCompanyFromPost("Hiring a Senior PM at MoEngage, the team that owns data")).toBe(
      "MoEngage",
    );
    expect(
      extractCompanyFromPost(
        "I'm hiring for the following roles at CoinDCX. Click below to apply today!",
      ),
    ).toBe("CoinDCX");
  });

  it("reads We're Hiring | Role | Company", () => {
    expect(
      extractCompanyFromPost("We're Hiring | SDET III – Performance Testing | Baazi Games We're looking"),
    ).toBe("Baazi Games");
  });
});

describe("inferCompany", () => {
  it("prefers post, then headline, then fallback", () => {
    expect(
      inferCompany({
        headline: "Tech Hiring !",
        rawText: "Tekion Corp is hiring engineers",
      }),
    ).toBe("Tekion Corp");
    expect(
      inferCompany({
        headline: "Talent Acquisition",
        rawText: "Join Our Team as a Devops Engineer",
        fallbacks: ["Nielsen"],
      }),
    ).toBe("Nielsen");
  });
});
