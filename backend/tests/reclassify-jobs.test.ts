import { describe, expect, it } from "vitest";
import { JOB_EXPIRY_DAYS } from "../src/lib/config";
import { MS_PER_DAY } from "../src/lib/job-expiry";
import { decideJobs, describeDecision, type StoredJob } from "../src/lib/reclassify-jobs";

const ENV = {} as NodeJS.ProcessEnv;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * MS_PER_DAY);
}

let nextId = 1;
function row(overrides: Partial<StoredJob> & Pick<StoredJob, "title" | "company" | "roleFamily">): StoredJob {
  return {
    id: nextId++,
    recruiterId: 1,
    authorTitle: "",
    rawText: "",
    postedAt: daysAgo(3),
    ...overrides,
  };
}

const AMAZON_HEADLINE =
  "Recruiter II - Science | Hiring Applied Scientists/Research Scientists/Data Scientists for Amazon";

/** The 16 rows the 2026-09-26 scrape produced, reconstructed from the stored fields. */
function productionRows(): { junk: StoredJob[]; good: StoredJob[]; fragmentCompany: StoredJob } {
  nextId = 1;
  const phonepe = row({ recruiterId: 10, title: "State Head - Sales", company: "PhonePe", roleFamily: "sales" });
  const swiggyCa = row({ recruiterId: 11, title: "CA Industrial Trainee", company: "Swiggy", roleFamily: "finance" });
  const swiggyPipe = row({
    recruiterId: 11,
    title: "| Swiggy | Bengaluru",
    company: "Bengaluru",
    roleFamily: "marketing",
    rawText: "We're Hiring | Lead / AM Campus Programs | Swiggy | Bengaluru",
  });
  const amazon1 = row({
    recruiterId: 12,
    title: "",
    company: "Unknown",
    roleFamily: "ai_ml",
    authorTitle: AMAZON_HEADLINE,
    rawText: "Exciting opportunities across Amazon science teams. Reach out to learn more!",
  });
  const amazon2 = row({
    recruiterId: 12,
    title: "",
    company: "Unknown",
    roleFamily: "ai_ml",
    authorTitle: AMAZON_HEADLINE,
    rawText: "Amazon science is growing. Ping me if you want to know more.",
    postedAt: daysAgo(5),
  });
  const salesEng1 = row({
    recruiterId: 13,
    title: "Senior Sales Engineer to partner with our enterprise sales t",
    company: "Unknown",
    roleFamily: "engineering",
  });
  const salesEng2 = row({
    recruiterId: 13,
    title: "Senior Sales Engineer to partner with our enterprise sales t",
    company: "Unknown",
    roleFamily: "engineering",
    postedAt: daysAgo(4),
  });
  const baaziDevops1 = row({
    recruiterId: 14,
    title: "DevOps Engineer II",
    company: "Baazi Games",
    roleFamily: "engineering",
    postedAt: daysAgo(12),
  });
  const baaziDevops2 = row({
    recruiterId: 14,
    title: "DevOps Engineer II",
    company: "Baazi Games",
    roleFamily: "engineering",
    postedAt: daysAgo(4),
  });
  const baaziSde = row({
    recruiterId: 14,
    title: "SDE III – Backend",
    company: "Baazi Games",
    roleFamily: "engineering",
    postedAt: daysAgo(6),
  });
  const databricks1 = row({
    recruiterId: 15,
    title: "Staff Software Engineer (Backend)",
    company: "Databricks",
    roleFamily: "engineering",
    authorTitle: "Staff Recruiter at Databricks",
  });
  const databricks2 = row({
    recruiterId: 15,
    title: "Senior Software Engineer - Platform",
    company: "Databricks",
    roleFamily: "engineering",
    authorTitle: "Staff Recruiter at Databricks",
  });
  const databricksFragment = row({
    recruiterId: 15,
    title: "Software Engineer - Data Infrastructure",
    company: "massive scale and work on the leading Data & AI pl",
    roleFamily: "engineering",
    authorTitle: "Staff Recruiter at Databricks",
    rawText: "Come work at massive scale and work on the leading Data & AI platform.",
  });
  const google = row({
    recruiterId: 16,
    title: "Software Engineer III",
    company: "Google lEx-JPMorganl lEx-Mindtreel",
    roleFamily: "engineering",
    authorTitle: "Senior Recruiter @ Google lEx-JPMorganl lEx-Mindtreel",
  });
  const physicalDesign = row({
    recruiterId: 17,
    title: "Physical Design Engineer",
    company: "Unknown",
    roleFamily: "engineering",
  });
  const mlEngineer = row({ recruiterId: 18, title: "ML Engineer", company: "Zepto", roleFamily: "ai_ml" });

  return {
    junk: [phonepe, swiggyCa, swiggyPipe, amazon1, amazon2, salesEng1, salesEng2, baaziDevops2],
    good: [baaziDevops1, baaziSde, databricks1, databricks2, google, physicalDesign, mlEngineer],
    fragmentCompany: databricksFragment,
  };
}

describe("decideJobs on the 16 production rows", () => {
  it("lists exactly the junk rows for deletion and keeps the rest", () => {
    const { junk, good, fragmentCompany } = productionRows();
    const all = [...junk, ...good, fragmentCompany];
    expect(all).toHaveLength(16);

    const decisions = decideJobs(all, ENV);
    const deleted = decisions.filter((d) => d.action === "delete").map((d) => d.id).sort((a, b) => a - b);
    expect(deleted).toEqual(junk.map((j) => j.id).sort((a, b) => a - b));

    const kept = decisions.filter((d) => d.action === "keep").map((d) => d.id).sort((a, b) => a - b);
    expect(kept).toEqual([...good, fragmentCompany].map((j) => j.id).sort((a, b) => a - b));
  });

  it("reports the expected reason per junk row", () => {
    const { junk, good, fragmentCompany } = productionRows();
    const decisions = decideJobs([...junk, ...good, fragmentCompany], ENV);
    const reason = (job: StoredJob) => {
      const d = decisions.find((x) => x.id === job.id);
      return d?.action === "delete" ? d.reason : d?.action;
    };
    const [phonepe, swiggyCa, swiggyPipe, amazon1, amazon2, salesEng1, salesEng2, baaziDevops2] = junk;
    expect(reason(phonepe)).toBe("off_target");
    expect(reason(swiggyCa)).toBe("off_target");
    expect(reason(swiggyPipe)).toBe("off_target");
    expect(reason(amazon1)).toBe("unparseable");
    expect(reason(amazon2)).toBe("unparseable");
    expect(reason(salesEng1)).toBe("off_target");
    expect(reason(salesEng2)).toBe("off_target");
    expect(reason(baaziDevops2)).toBe("duplicate");
  });

  it("keeps the earlier Baazi DevOps post and names it as the original", () => {
    const { junk, good, fragmentCompany } = productionRows();
    const decisions = decideJobs([...junk, ...good, fragmentCompany], ENV);
    const baaziDevops1 = good[0];
    const baaziDevops2 = junk[7];
    const later = decisions.find((d) => d.id === baaziDevops2.id);
    expect(later).toMatchObject({ action: "delete", reason: "duplicate", detail: `near-duplicate of job #${baaziDevops1.id}` });
    expect(decisions.find((d) => d.id === baaziDevops1.id)).toEqual({ id: baaziDevops1.id, action: "keep" });
  });

  it("repairs the fragment and headline-noise companies instead of deleting them", () => {
    const { junk, good, fragmentCompany } = productionRows();
    const decisions = decideJobs([...junk, ...good, fragmentCompany], ENV);
    const google = good[4];
    expect(decisions.find((d) => d.id === fragmentCompany.id)).toEqual({
      id: fragmentCompany.id,
      action: "keep",
      fix: { company: "Databricks" },
    });
    expect(decisions.find((d) => d.id === google.id)).toEqual({ id: google.id, action: "keep", fix: { company: "Google" } });
    expect(describeDecision(decisions.find((d) => d.id === google.id)!, google)).toBe(
      'ok, fix company "Google lEx-JPMorganl lEx-Mindtreel" -> "Google"',
    );
  });

  it("does not treat the same role at different recruiters as duplicates", () => {
    nextId = 1;
    const a = row({ recruiterId: 1, title: "Backend Engineer", company: "Zepto", roleFamily: "engineering" });
    const b = row({ recruiterId: 2, title: "Backend Engineer", company: "Zepto", roleFamily: "engineering" });
    expect(decideJobs([a, b], ENV).every((d) => d.action === "keep")).toBe(true);
  });

  it("does not delete an unexpired row as a duplicate of an expired original", () => {
    nextId = 1;
    const expired = row({
      title: "Backend Engineer",
      company: "Zepto",
      roleFamily: "engineering",
      postedAt: daysAgo(JOB_EXPIRY_DAYS + 1),
    });
    const live = row({
      title: "Backend Engineer",
      company: "Zepto",
      roleFamily: "engineering",
      postedAt: daysAgo(JOB_EXPIRY_DAYS - 10),
    });
    const decisions = decideJobs([expired, live], ENV);
    expect(decisions).toEqual([
      { id: expired.id, action: "keep" },
      { id: live.id, action: "keep" },
    ]);
  });

  it("still collapses near-duplicates among unexpired rows", () => {
    nextId = 1;
    const first = row({ title: "Backend Engineer", company: "Zepto", roleFamily: "engineering", postedAt: daysAgo(12) });
    const second = row({ title: "Backend Engineer", company: "Zepto", roleFamily: "engineering", postedAt: daysAgo(2) });
    const decisions = decideJobs([first, second], ENV);
    expect(decisions.find((d) => d.id === second.id)).toMatchObject({ action: "delete", reason: "duplicate" });
  });
});
