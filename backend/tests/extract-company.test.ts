import { describe, expect, it } from "vitest";
import {
  cleanCompanyName,
  extractCompanyFromHeadline,
  extractCompanyFromPost,
  inferCompany,
  isSuspiciousCompany,
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

  it("strips lEx-...l headline noise so Google survives", () => {
    expect(
      extractCompanyFromHeadline("Senior Recruiter @ Google lEx-JPMorganl lEx-Mindtreel"),
    ).toBe("Google");
  });

  it("reads at Company from a Databricks recruiter headline", () => {
    expect(extractCompanyFromHeadline("Staff Recruiter at Databricks")).toBe("Databricks");
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
    expect(
      extractCompanyFromPost("We're Hiring | DevOps Engineer II | Baazi Games. Kubernetes, AWS, Terraform."),
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

describe("cleanCompanyName", () => {
  it("strips Ex-employer noise and trailing pipes", () => {
    expect(cleanCompanyName("Google lEx-JPMorganl lEx-Mindtreel")).toBe("Google");
    expect(cleanCompanyName("Google | Ex-Amazon | Ex-Flipkart")).toBe("Google");
    expect(cleanCompanyName("Google (Ex-Amazon)")).toBe("Google");
    expect(cleanCompanyName("Google Ex-Amazon")).toBe("Google");
    expect(cleanCompanyName("Google |")).toBe("Google");
    expect(cleanCompanyName("| Google")).toBe("Google");
  });

  it("rejects sentence fragments and cities", () => {
    expect(cleanCompanyName("massive scale and work on the leading Data & AI pl")).toBe("");
    expect(cleanCompanyName("Bengaluru")).toBe("");
    expect(cleanCompanyName("Delhi NCR")).toBe("");
    expect(cleanCompanyName("remote")).toBe("");
    expect(cleanCompanyName("the team that owns data")).toBe("");
  });

  it("keeps real multi-word firms", () => {
    expect(cleanCompanyName("Walmart Global Tech India")).toBe("Walmart Global Tech India");
    expect(cleanCompanyName("Baazi Games")).toBe("Baazi Games");
    expect(cleanCompanyName("Tekion Corp")).toBe("Tekion Corp");
  });
});

describe("isSuspiciousCompany", () => {
  it("flags fragments, cities, and long values", () => {
    expect(isSuspiciousCompany("massive scale and work on the leading Data & AI pl")).toBe(true);
    expect(isSuspiciousCompany("Bengaluru")).toBe(true);
    expect(isSuspiciousCompany("Gurgaon")).toBe(true);
    expect(isSuspiciousCompany("India")).toBe(true);
    expect(isSuspiciousCompany("Remote")).toBe(true);
    expect(isSuspiciousCompany("a".repeat(41))).toBe(true);
    expect(isSuspiciousCompany("the leading platform")).toBe(true);
    expect(isSuspiciousCompany("Johnson and Johnson")).toBe(true);
    expect(isSuspiciousCompany("")).toBe(true);
  });

  it("accepts Unknown and ordinary names", () => {
    expect(isSuspiciousCompany("Unknown")).toBe(false);
    expect(isSuspiciousCompany("Databricks")).toBe(false);
    expect(isSuspiciousCompany("Walmart Global Tech India")).toBe(false);
    expect(isSuspiciousCompany("upGrad")).toBe(false);
    expect(isSuspiciousCompany("PhonePe")).toBe(false);
  });
});

describe("inferCompany with fragment post text", () => {
  it("prefers the headline company over a Databricks sentence fragment", () => {
    expect(
      inferCompany({
        headline: "Staff Recruiter at Databricks",
        rawText:
          "Come work at massive scale and work on the leading Data & AI platform. We are hiring Staff Software Engineers.",
      }),
    ).toBe("Databricks");
  });

  it("does not return a city from a pipe header", () => {
    expect(
      inferCompany({
        headline: "Campus Programs | Swiggy",
        rawText: "We're Hiring | Lead / AM Campus Programs | Swiggy | Bengaluru",
      }),
    ).toBe("Swiggy");
  });
});
