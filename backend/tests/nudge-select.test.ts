import { describe, expect, it } from "vitest";
import {
  effectiveSeniority,
  isSeniorRole,
  minimumYears,
  pickBullets,
  posterKind,
  posterLine,
  selectJobsForUser,
  type NudgeJobInput,
} from "../src/lib/nudge-select";

const NOW = new Date("2026-09-29T08:00:00Z");
const d = (iso: string) => new Date(iso);

// Fixtures mirror live rows from the design snapshot.
function job(overrides: Partial<NudgeJobInput> & { id: number }): NudgeJobInput {
  return {
    title: "SDE 1",
    company: "M2P Fintech",
    author: "Srinivasarao Narayanasetty",
    authorTitle: "Engineering Manager at M2P",
    source: "linkedin",
    sourceUrl: `https://www.linkedin.com/posts/example-${overrides.id}`,
    roleFamily: "engineering",
    seniority: "junior",
    remoteMode: "in_office",
    stack: ["python", "nodejs", "java"],
    description: [
      "Fast-paced fintech environment where work ships and scales",
      "Large-scale fintech products used by millions with strong growth paths",
    ],
    rawText: "We are hiring SDE 1 at M2P Fintech",
    postedAt: d("2026-09-23T10:00:00Z"),
    createdAt: d("2026-09-26T04:00:00Z"),
    ...overrides,
  };
}

const sde1Profile = { roleFamily: "engineering", seniority: "junior", remoteMode: "in_office", stack: ["java", "python", "sql", "aws"] };

describe("senior override", () => {
  it("reads the smallest stated years figure", () => {
    expect(minimumYears("7-12 YOE in backend")).toBe(7);
    expect(minimumYears("5+ years of experience")).toBe(5);
    expect(minimumYears("3–5 years of experience building scalable systems")).toBe(3);
    expect(minimumYears("no years here")).toBeNull();
  });

  it("flags SDE III and 5+ years as senior even when stored as mid", () => {
    expect(isSeniorRole({ title: "SDE III – Backend", description: [] })).toBe(true);
    expect(isSeniorRole({ title: "Backend Engineer", description: ["7-12 YOE", "Hybrid in Delhi NCR"] })).toBe(true);
    expect(isSeniorRole({ title: "Staff Engineer", description: [] })).toBe(true);
    expect(effectiveSeniority({ title: "SDE III – Backend", description: [], seniority: "mid" })).toBe("senior");
  });

  it("leaves genuine SDE-1 / SDE-2 rows alone", () => {
    expect(isSeniorRole({ title: "Software Engineer", description: ["1-3 years of experience as an SDE."] })).toBe(false);
    expect(effectiveSeniority({ title: "DevOps Engineer II", description: ["3–5 years of experience"], seniority: "mid" })).toBe("mid");
    expect(effectiveSeniority({ title: "Associate SDE", description: ["Looking for freshers"], seniority: "intern" })).toBe("intern");
  });

  it("does not demote a role that is already senior", () => {
    expect(effectiveSeniority({ title: "Head of Engineering", description: [], seniority: "head" })).toBe("head");
  });
});

describe("poster labelling", () => {
  it("labels recruiters, hiring managers and engineers", () => {
    expect(posterKind("Talent Acquisition @Zepto")).toBe("Recruiter");
    expect(posterKind("Talent Acquisition Manager at Hevo")).toBe("Recruiter");
    expect(posterKind("Engineering Manager at M2P")).toBe("Hiring manager");
    expect(posterKind("Co-founder & CTO | Building Acme")).toBe("Hiring manager");
    expect(posterKind("Software Engineer II @ Microsoft")).toBe("Engineer (referral)");
  });

  it("uses the first headline segment that names a role, capped at 60 chars", () => {
    expect(posterLine("I talk to strangers for a living… | Talent Acquisition | Baazi Games")).toBe("Talent Acquisition");
    expect(posterLine("Engineering Manager at M2P | Ex-Amazon")).toBe("Engineering Manager at M2P");
    const long = posterLine("Senior Engineering Manager leading platform, payments and infrastructure teams at a fintech");
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("pickBullets", () => {
  it("prefers bullets that state years or a location, keeping original order", () => {
    const bullets = pickBullets([
      "High impact, zero micromanagement environment with a modern codebase.",
      "1-3 years of experience as a Software Development Engineer (SDE).",
      "Join us in Bangalore.",
      "Free snacks.",
    ]);
    expect(bullets).toEqual([
      "1-3 years of experience as a Software Development Engineer (SDE).",
      "Join us in Bangalore.",
    ]);
  });

  it("falls back to the first two bullets", () => {
    expect(pickBullets(["a", "b", "c"])).toEqual(["a", "b"]);
    expect(pickBullets([])).toEqual([]);
  });
});

describe("selectJobsForUser", () => {
  it("ranks by match and repairs the company through the ingest gates", () => {
    const jobs = [
      job({ id: 23 }),
      job({ id: 91, title: "Software Engineer", company: "Bangalore", authorTitle: "Talent Acquisition @Swiggy", stack: ["go"] }),
    ];
    const { picks, poolSize } = selectJobsForUser({ jobs, profile: sde1Profile, now: NOW });
    expect(poolSize).toBe(2);
    expect(picks.map((j) => j.id)).toEqual([23, 91]);
    expect(picks[0].matchPercent).toBeGreaterThan(picks[1].matchPercent);
    expect(picks[1].company).toBe("Swiggy");
    expect(picks[0].posterKind).toBe("Hiring manager");
    expect(picks[0].levelLabel).toBe("SDE-1 level");
  });

  it("drops rows that fail the gates: off-target roles, recruiter titles, malformed titles", () => {
    const jobs = [
      job({ id: 1, roleFamily: "sales", title: "Account Executive" }),
      job({ id: 2, title: "Technical Recruiter" }),
      job({ id: 3, title: "|| Bangalore", rawText: "Bangalore office opening" }),
      job({ id: 4 }),
    ];
    const { picks } = selectJobsForUser({ jobs, profile: sde1Profile, now: NOW });
    expect(picks.map((j) => j.id)).toEqual([4]);
  });

  it("applies the senior override so an SDE III is not shown as SDE-2", () => {
    const jobs = [job({ id: 8, title: "SDE III – Backend", company: "Baazi Games", seniority: "mid" }), job({ id: 23 })];
    const { picks } = selectJobsForUser({ jobs, profile: sde1Profile, now: NOW });
    const senior = picks.find((j) => j.id === 8)!;
    expect(senior.seniority).toBe("senior");
    expect(senior.seniorOverride).toBe(true);
    expect(senior.levelLabel).toBe("Senior / SDE-3+");
    expect(picks[0].id).toBe(23);
    expect(senior.matchPercent).toBeLessThan(picks[0].matchPercent);
  });

  it("never repeats a job already sent to this user", () => {
    const jobs = [job({ id: 23 }), job({ id: 24 })];
    const { picks } = selectJobsForUser({ jobs, profile: sde1Profile, excludeJobIds: [23], now: NOW });
    expect(picks.map((j) => j.id)).toEqual([24]);
  });

  it("skips expired jobs and returns empty picks when nothing qualifies", () => {
    const jobs = [job({ id: 1, postedAt: d("2026-08-01T00:00:00Z") })];
    const result = selectJobsForUser({ jobs, profile: sde1Profile, now: NOW });
    expect(result.picks).toEqual([]);
    expect(result.poolSize).toBe(0);
  });

  it("prefers jobs ingested since the last nudge, then fills with older ones", () => {
    const jobs = [
      job({ id: 1, createdAt: d("2026-09-20T00:00:00Z"), stack: ["java", "python", "sql", "aws"] }),
      job({ id: 2, createdAt: d("2026-09-28T00:00:00Z"), stack: [] }),
    ];
    const since = d("2026-09-22T00:00:00Z");
    const { picks, newCount } = selectJobsForUser({ jobs, profile: sde1Profile, sinceCreatedAt: since, now: NOW, limit: 2 });
    expect(newCount).toBe(1);
    expect(picks.map((j) => j.id)).toEqual([2, 1]);
    expect(picks[0].isNew).toBe(true);
    expect(picks[1].isNew).toBe(false);
  });

  it("honours the limit", () => {
    const jobs = Array.from({ length: 8 }, (_, i) => job({ id: i + 1 }));
    expect(selectJobsForUser({ jobs, profile: sde1Profile, now: NOW }).picks).toHaveLength(5);
    expect(selectJobsForUser({ jobs, profile: sde1Profile, now: NOW, limit: 3 }).picks).toHaveLength(3);
  });
});
