import { describe, expect, it } from "vitest";
import type { JobDetail } from "./data";
import {
  buildJobPostingJsonLd,
  jobDescriptionHtml,
  jobMetaDescription,
  jobSlug,
  jobSummary,
  jobValidThrough,
  parseJobSlug,
  serializeJsonLd,
} from "./job-seo";

const POSTED = "2026-11-01T10:00:00.000Z";
const NOW = new Date("2026-11-04T10:00:00.000Z");

function detail(overrides: Partial<JobDetail> = {}): JobDetail {
  return {
    id: 42,
    title: "Senior Backend Engineer",
    company: "Razorpay",
    author: "Harish Kumar",
    authorTitle: "VP Engineering @ Razorpay",
    roleBadge: "Senior Backend Engineer @ Razorpay",
    source: "linkedin",
    sourceUrl: "https://www.linkedin.com/posts/harish-hiring",
    roleFamily: "engineering",
    seniority: "senior",
    remoteMode: "in-office",
    stack: ["go", "node.js"],
    description: ["5+ years building payment systems", "Own the ledger service"],
    locations: [{ city: "Bengaluru", region: "Karnataka", country: "IN" }],
    country: "IN",
    employmentTypes: ["FULL_TIME"],
    posterKind: "Hiring manager",
    levelLabel: "Senior / SDE-3+",
    remoteLabel: "In-office",
    comments: 0,
    score: 3,
    postedAt: POSTED,
    expiresAt: "2026-12-01T10:00:00.000Z",
    expired: false,
    ...overrides,
  };
}

describe("jobSlug / parseJobSlug", () => {
  it("reads title, company and city, ending in the stable id", () => {
    expect(jobSlug(detail())).toBe("senior-backend-engineer-razorpay-bengaluru-42");
    expect(parseJobSlug("senior-backend-engineer-razorpay-bengaluru-42")).toBe(42);
  });

  it("leaves out an unknown company and a missing city", () => {
    expect(jobSlug(detail({ company: "Unknown", locations: [] }))).toBe("senior-backend-engineer-42");
  });

  it("keeps long slugs short and still parseable", () => {
    const slug = jobSlug(detail({ title: "Staff Engineer ".repeat(12) }));
    expect(slug.length).toBeLessThanOrEqual(90);
    expect(parseJobSlug(slug)).toBe(42);
  });

  it("accepts a bare id and rejects slugs without one", () => {
    expect(parseJobSlug("42")).toBe(42);
    expect(parseJobSlug("senior-backend-engineer")).toBeNull();
    expect(parseJobSlug("engineer-0")).toBeNull();
  });
});

describe("jobValidThrough", () => {
  it("is postedAt plus JOB_EXPIRY_DAYS (30)", () => {
    expect(jobValidThrough(POSTED)).toBe("2026-12-01T10:00:00.000Z");
  });
});

describe("buildJobPostingJsonLd", () => {
  it("emits every required and recommended field we have for an onsite job", () => {
    const ld = buildJobPostingJsonLd(detail(), NOW)!;
    expect(ld).toMatchObject({
      "@context": "https://schema.org/",
      "@type": "JobPosting",
      title: "Senior Backend Engineer",
      datePosted: POSTED,
      validThrough: "2026-12-01T10:00:00.000Z",
      employmentType: "FULL_TIME",
      hiringOrganization: { "@type": "Organization", name: "Razorpay" },
      jobLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Bengaluru",
          addressRegion: "Karnataka",
          addressCountry: "IN",
        },
      },
      identifier: { "@type": "PropertyValue", name: "SkipTheBoard", value: "42" },
      directApply: false,
      url: "https://skiptheboard.in/jobs/senior-backend-engineer-razorpay-bengaluru-42",
    });
    expect(ld).not.toHaveProperty("jobLocationType");
    expect(ld).not.toHaveProperty("applicantLocationRequirements");
    // Nothing we do not know: no logo, sameAs, salary.
    expect(ld.hiringOrganization).not.toHaveProperty("logo");
    expect(ld.hiringOrganization).not.toHaveProperty("sameAs");
    expect(ld).not.toHaveProperty("baseSalary");
  });

  it("lists every city the post names", () => {
    const ld = buildJobPostingJsonLd(
      detail({
        locations: [
          { city: "Bengaluru", region: "Karnataka", country: "IN" },
          { city: "Pune", region: "Maharashtra", country: "IN" },
        ],
      }),
      NOW,
    )!;
    expect(Array.isArray(ld.jobLocation)).toBe(true);
    expect((ld.jobLocation as unknown[]).length).toBe(2);
  });

  it("marks a remote job TELECOMMUTE with the applicant country", () => {
    const ld = buildJobPostingJsonLd(detail({ remoteMode: "remote", locations: [], remoteLabel: "Remote" }), NOW)!;
    expect(ld.jobLocationType).toBe("TELECOMMUTE");
    expect(ld.applicantLocationRequirements).toEqual({ "@type": "Country", name: "India" });
    expect(ld).not.toHaveProperty("jobLocation");
  });

  it("omits employmentType when the post does not state one", () => {
    expect(buildJobPostingJsonLd(detail({ employmentTypes: [] }), NOW)).not.toHaveProperty("employmentType");
    expect(buildJobPostingJsonLd(detail({ employmentTypes: ["FULL_TIME", "CONTRACTOR"] }), NOW)!.employmentType).toEqual([
      "FULL_TIME",
      "CONTRACTOR",
    ]);
  });

  it("is skipped when the company is unknown", () => {
    expect(buildJobPostingJsonLd(detail({ company: "Unknown" }), NOW)).toBeNull();
    expect(buildJobPostingJsonLd(detail({ company: "  " }), NOW)).toBeNull();
  });

  it("is skipped when there is no location to state", () => {
    expect(buildJobPostingJsonLd(detail({ locations: [] }), NOW)).toBeNull();
    expect(buildJobPostingJsonLd(detail({ remoteMode: "remote", locations: [], country: null }), NOW)).toBeNull();
  });

  it("is skipped for an expired job", () => {
    expect(buildJobPostingJsonLd(detail({ expired: true }), NOW)).toBeNull();
    expect(buildJobPostingJsonLd(detail(), new Date("2026-12-01T10:00:00.000Z"))).toBeNull();
    expect(buildJobPostingJsonLd(detail(), new Date("2026-12-01T09:59:59.000Z"))).not.toBeNull();
  });
});

describe("description and summary", () => {
  it("is our own summary plus the extracted points, HTML-escaped", () => {
    const html = jobDescriptionHtml(detail({ description: ["Rust <and> Go"] }));
    expect(html).toContain(
      "<p>Razorpay is hiring for the role of Senior Backend Engineer in Bengaluru. Senior / SDE-3+, In-office, Full-time.</p>",
    );
    expect(html).toContain("<p>Skills: Go, Node.js</p>");
    expect(html).toContain("<li>Rust &lt;and&gt; Go</li>");
    expect(html).toContain("Posted on LinkedIn by Harish · Hiring manager.");
    expect(html).not.toContain("Kumar");
  });

  it("says remote instead of a city for remote jobs", () => {
    expect(jobSummary(detail({ remoteMode: "remote", locations: [], remoteLabel: "Remote" }))).toBe(
      "Razorpay is hiring for the role of Senior Backend Engineer to work remotely from India. Senior / SDE-3+, Full-time.",
    );
  });

  it("keeps the meta description within 160 characters, dropping whole sentences", () => {
    const text = jobMetaDescription(detail({ title: "Principal Distributed Systems Engineer, Payments Platform" }));
    expect(text.length).toBeLessThanOrEqual(160);
    expect(text.endsWith(".")).toBe(true);
    expect(jobMetaDescription(detail({ stack: [] }))).toContain("Posted by the hiring manager on LinkedIn.");
    expect(jobMetaDescription(detail({ title: "Engineer ".repeat(30) })).length).toBeLessThanOrEqual(160);
  });
});

describe("serializeJsonLd", () => {
  it("cannot close the script tag", () => {
    const out = serializeJsonLd({ title: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out).title).toBe("</script><script>alert(1)</script>");
  });
});
