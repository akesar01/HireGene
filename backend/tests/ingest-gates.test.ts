import { describe, expect, it } from "vitest";
import {
  allowedRoleFamilies,
  evaluateJobGates,
  findNearDuplicate,
  isNearDuplicate,
  isOffTargetTitle,
  isWellFormedTitle,
  normalizeForDedupe,
} from "../src/lib/ingest-gates";
import { MS_PER_DAY } from "../src/lib/job-expiry";

const ENV = { INGEST_ROLE_FAMILIES: undefined } as NodeJS.ProcessEnv;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * MS_PER_DAY);
}

describe("allowedRoleFamilies", () => {
  it("defaults to engineering and ai_ml", () => {
    expect([...allowedRoleFamilies({})].sort()).toEqual(["ai_ml", "engineering"]);
  });

  it("reads INGEST_ROLE_FAMILIES and ignores junk entries", () => {
    expect([...allowedRoleFamilies({ INGEST_ROLE_FAMILIES: "engineering, data ,bogus," })].sort()).toEqual([
      "data",
      "engineering",
    ]);
  });

  it("falls back to the default when the env value has no valid families", () => {
    expect([...allowedRoleFamilies({ INGEST_ROLE_FAMILIES: "nope" })].sort()).toEqual(["ai_ml", "engineering"]);
  });
});

describe("isOffTargetTitle", () => {
  it("flags engineering-adjacent sales, support, and recruiting titles", () => {
    expect(isOffTargetTitle("Senior Sales Engineer to partner with our enterprise sales t")).toBe(true);
    expect(isOffTargetTitle("Solutions Engineer")).toBe(true);
    expect(isOffTargetTitle("Pre-Sales Consultant")).toBe(true);
    expect(isOffTargetTitle("Presales Engineer")).toBe(true);
    expect(isOffTargetTitle("Customer Success Manager")).toBe(true);
    expect(isOffTargetTitle("Support Engineer")).toBe(true);
    expect(isOffTargetTitle("Technical Support Engineer")).toBe(true);
    expect(isOffTargetTitle("Technical Recruiter")).toBe(true);
    expect(isOffTargetTitle("Talent Acquisition Partner")).toBe(true);
  });

  it("keeps real engineering titles", () => {
    expect(isOffTargetTitle("Staff Software Engineer (Backend)")).toBe(false);
    expect(isOffTargetTitle("SDE III – Backend")).toBe(false);
    expect(isOffTargetTitle("Physical Design Engineer")).toBe(false);
    expect(isOffTargetTitle("DevOps Engineer II")).toBe(false);
    expect(isOffTargetTitle("Software Engineer - Database Internals")).toBe(false);
  });
});

describe("isWellFormedTitle", () => {
  it("rejects empty, tiny, punctuation-only, pipe-fragment, and location titles", () => {
    expect(isWellFormedTitle("")).toBe(false);
    expect(isWellFormedTitle("   ")).toBe(false);
    expect(isWellFormedTitle("QA")).toBe(false);
    expect(isWellFormedTitle("---")).toBe(false);
    expect(isWellFormedTitle("| | |")).toBe(false);
    expect(isWellFormedTitle("| Swiggy | Bengaluru")).toBe(false);
    expect(isWellFormedTitle("Bengaluru")).toBe(false);
    expect(isWellFormedTitle("Bengaluru, India")).toBe(false);
    expect(isWellFormedTitle("Remote | India")).toBe(false);
    expect(isWellFormedTitle("Location: Hyderabad")).toBe(false);
  });

  it("accepts real titles including ones with dashes and parentheses", () => {
    expect(isWellFormedTitle("Staff Software Engineer (Backend)")).toBe(true);
    expect(isWellFormedTitle("SDE III – Backend")).toBe(true);
    expect(isWellFormedTitle("Physical Design Engineer")).toBe(true);
    expect(isWellFormedTitle("Software Engineer - Database Internals")).toBe(true);
    expect(isWellFormedTitle("ML Engineer")).toBe(true);
  });
});

describe("evaluateJobGates on the 2026-09-26 production rows", () => {
  it("rejects a sales role at PhonePe as off_target", () => {
    const result = evaluateJobGates(
      { title: "State Head - Sales", company: "PhonePe", roleFamily: "sales", authorTitle: "TA @ PhonePe", rawText: "" },
      ENV,
    );
    expect(result).toMatchObject({ ok: false, reason: "off_target" });
  });

  it("rejects a finance trainee at Swiggy as off_target", () => {
    const result = evaluateJobGates(
      { title: "CA Industrial Trainee", company: "Swiggy", roleFamily: "finance", authorTitle: "", rawText: "" },
      ENV,
    );
    expect(result).toMatchObject({ ok: false, reason: "off_target" });
  });

  it("rejects the marketing pipe-fragment row whose company is a city as off_target", () => {
    const result = evaluateJobGates(
      {
        title: "| Swiggy | Bengaluru",
        company: "Bengaluru",
        roleFamily: "marketing",
        authorTitle: "Campus Programs | Swiggy",
        rawText: "We're Hiring | Lead / AM Campus Programs | Swiggy | Bengaluru",
      },
      ENV,
    );
    expect(result).toMatchObject({ ok: false, reason: "off_target" });
  });

  it("rejects the same pipe-fragment title as unparseable even when the family is allowed", () => {
    const result = evaluateJobGates(
      {
        title: "| Swiggy | Bengaluru",
        company: "Bengaluru",
        roleFamily: "engineering",
        authorTitle: "Campus Programs | Swiggy",
        rawText: "Campus programs update. Reach out for details.",
      },
      ENV,
    );
    expect(result).toMatchObject({ ok: false, reason: "unparseable" });
  });

  it("rejects the empty-title Amazon science rows as unparseable", () => {
    const amazon = {
      title: "",
      company: "Unknown",
      roleFamily: "ai_ml",
      authorTitle:
        "Recruiter II - Science | Hiring Applied Scientists/Research Scientists/Data Scientists for Amazon",
      rawText: "Exciting opportunities across Amazon science teams. Reach out to learn more!",
    };
    expect(evaluateJobGates(amazon, ENV)).toMatchObject({ ok: false, reason: "unparseable" });
    expect(evaluateJobGates({ ...amazon, rawText: "" }, ENV)).toMatchObject({ ok: false, reason: "unparseable" });
  });

  it("recovers a concrete title from the post when the classifier left it empty", () => {
    const result = evaluateJobGates(
      {
        title: "",
        company: "Razorpay",
        roleFamily: "engineering",
        authorTitle: "Engineering Manager @ Razorpay",
        rawText: "We're hiring a Senior Backend Engineer\nCome build payments infra with us.",
      },
      ENV,
    );
    expect(result).toMatchObject({ ok: true, title: "Senior Backend Engineer", company: "Razorpay" });
  });

  it("rejects the truncated Senior Sales Engineer rows as off_target even though the family is engineering", () => {
    const result = evaluateJobGates(
      {
        title: "Senior Sales Engineer to partner with our enterprise sales t",
        company: "Unknown",
        roleFamily: "engineering",
        authorTitle: "Talent Partner",
        rawText: "We're hiring a Senior Sales Engineer to partner with our enterprise sales team.",
      },
      ENV,
    );
    expect(result).toMatchObject({ ok: false, reason: "off_target" });
  });

  it("replaces the Databricks sentence-fragment company with the headline company", () => {
    const result = evaluateJobGates(
      {
        title: "Staff Software Engineer (Backend)",
        company: "massive scale and work on the leading Data & AI pl",
        roleFamily: "engineering",
        authorTitle: "Staff Recruiter at Databricks",
        rawText: "Join us at massive scale and work on the leading Data & AI platform.",
      },
      ENV,
    );
    expect(result).toMatchObject({ ok: true, title: "Staff Software Engineer (Backend)", company: "Databricks" });
  });

  it("cleans the Google headline-noise company", () => {
    const result = evaluateJobGates(
      {
        title: "Software Engineer III",
        company: "Google lEx-JPMorganl lEx-Mindtreel",
        roleFamily: "engineering",
        authorTitle: "Senior Recruiter @ Google lEx-JPMorganl lEx-Mindtreel",
        rawText: "Hiring Software Engineer III. DM me.",
      },
      ENV,
    );
    expect(result).toMatchObject({ ok: true, company: "Google" });
  });

  it("falls back to Unknown when a city company has no usable headline", () => {
    const result = evaluateJobGates(
      {
        title: "Physical Design Engineer",
        company: "Hyderabad",
        roleFamily: "engineering",
        authorTitle: "Talent Acquisition | Campus & Lateral Hiring",
        rawText: "",
      },
      ENV,
    );
    expect(result).toMatchObject({ ok: true, company: "Unknown" });
  });

  it("keeps the good production rows untouched", () => {
    const good = [
      { title: "Staff Software Engineer (Backend)", company: "Databricks", roleFamily: "engineering" },
      { title: "SDE III – Backend", company: "Baazi Games", roleFamily: "engineering" },
      { title: "Physical Design Engineer", company: "Unknown", roleFamily: "engineering" },
      { title: "DevOps Engineer II", company: "Baazi Games", roleFamily: "engineering" },
      { title: "Applied Scientist", company: "Amazon", roleFamily: "ai_ml" },
    ];
    for (const row of good) {
      expect(evaluateJobGates({ ...row, authorTitle: "", rawText: "" }, ENV)).toEqual({
        ok: true,
        title: row.title,
        company: row.company,
      });
    }
  });

  it("honours INGEST_ROLE_FAMILIES", () => {
    const row = { title: "Data Analyst", company: "Zepto", roleFamily: "data", authorTitle: "", rawText: "" };
    expect(evaluateJobGates(row, ENV)).toMatchObject({ ok: false, reason: "off_target" });
    expect(evaluateJobGates(row, { INGEST_ROLE_FAMILIES: "engineering,data" })).toMatchObject({ ok: true });
  });
});

describe("near-duplicate rule", () => {
  it("normalizes case, punctuation, and whitespace", () => {
    expect(normalizeForDedupe("  DevOps   Engineer-II ")).toBe(normalizeForDedupe("devops engineer ii"));
    expect(normalizeForDedupe("SDE III – Backend")).toBe("sde iii backend");
  });

  it("catches the two Baazi Games DevOps posts eight days apart", () => {
    const first = { title: "DevOps Engineer II", company: "Baazi Games", postedAt: daysAgo(10) };
    const second = { title: "DevOps Engineer II", company: "Baazi Games", postedAt: daysAgo(2) };
    expect(isNearDuplicate(first, second)).toBe(true);
    expect(isNearDuplicate(second, first)).toBe(true);
  });

  it("does not collapse different roles at the same company", () => {
    const devops = { title: "DevOps Engineer II", company: "Baazi Games", postedAt: daysAgo(3) };
    const sde = { title: "SDE III – Backend", company: "Baazi Games", postedAt: daysAgo(3) };
    expect(isNearDuplicate(devops, sde)).toBe(false);
  });

  it("does not collapse the same title at different companies or outside 14 days", () => {
    const a = { title: "DevOps Engineer II", company: "Baazi Games", postedAt: daysAgo(3) };
    expect(isNearDuplicate(a, { ...a, company: "Zepto" })).toBe(false);
    expect(isNearDuplicate(a, { ...a, postedAt: daysAgo(20) })).toBe(false);
  });

  it("finds the matching existing row from a list", () => {
    const existing = [
      { id: 1, title: "SDE III – Backend", company: "Baazi Games", postedAt: daysAgo(9) },
      { id: 2, title: "DevOps Engineer II", company: "Baazi Games", postedAt: daysAgo(10) },
    ];
    const hit = findNearDuplicate(
      { title: "DevOps Engineer II", company: "Baazi Games", postedAt: daysAgo(2) },
      existing,
    );
    expect(hit?.id).toBe(2);
    expect(
      findNearDuplicate({ title: "QA Engineer", company: "Baazi Games", postedAt: daysAgo(2) }, existing),
    ).toBeUndefined();
  });
});
