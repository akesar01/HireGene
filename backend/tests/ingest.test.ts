import { beforeEach, describe, expect, it, vi } from "vitest";
import { MS_PER_DAY } from "../src/lib/job-expiry";

// ─── In-memory Prisma fake ───────────────────────────────────────────────────

type Classification = {
  isJobPost: boolean;
  title: string;
  roleFamily: string;
  seniority: string;
  remoteMode: string;
  techStack: string[];
  description: string[];
};

interface FakeJob {
  id: number;
  recruiterId: number;
  title: string;
  company: string;
  roleFamily: string;
  sourceUrl: string;
  contentHash: string;
  postedAt: Date;
  authorTitle: string;
  roleBadge: string;
  [key: string]: unknown;
}

const { db, prisma, classifications } = vi.hoisted(() => {
  const db = { jobs: [] as FakeJob[], nextId: 1 };
  const classifications = new Map<string, Classification>();
  const prisma = {
  job: {
    findUnique: vi.fn(async ({ where }: { where: { sourceUrl: string } }) =>
      db.jobs.find((j) => j.sourceUrl === where.sourceUrl) ?? null),
    findFirst: vi.fn(async ({ where }: { where: { recruiterId: number } }) =>
      db.jobs.filter((j) => j.recruiterId === where.recruiterId && j.company.toLowerCase() !== "unknown").at(-1) ?? null),
    findMany: vi.fn(async ({ where }: { where: { recruiterId: number; postedAt?: { gt: Date } } }) =>
      db.jobs.filter((j) => j.recruiterId === where.recruiterId && (!where.postedAt || j.postedAt > where.postedAt.gt))),
    create: vi.fn(async ({ data }: { data: Omit<FakeJob, "id"> }) => {
      const job = { ...data, id: db.nextId++ } as FakeJob;
      db.jobs.push(job);
      return job;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: number }; data: Partial<FakeJob> }) => {
      const job = db.jobs.find((j) => j.id === where.id)!;
      Object.assign(job, data);
      return job;
    }),
  },
  recruiterSubmission: {
    findFirst: vi.fn(async () => null),
  },
  };
  return { db, prisma, classifications };
});

vi.mock("../src/lib/prisma", () => ({ prisma }));

// ─── Classifier fake keyed by post text ──────────────────────────────────────

vi.mock("../src/lib/llm-classifier", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/llm-classifier")>()),
  classifyPost: vi.fn(async (text: string) => {
    const hit = classifications.get(text);
    if (!hit) throw new Error(`no fake classification for: ${text}`);
    return hit;
  }),
}));

import { ingestPosts, type ApifyPost } from "../src/lib/apify";

const RECRUITER = { id: 7, name: "Test Recruiter" };

function daysAgo(days: number): number {
  return Date.now() - days * MS_PER_DAY;
}

function post(opts: {
  url: string;
  text: string;
  headline: string;
  daysAgo?: number;
  cls: Partial<Classification> & { title: string; roleFamily: string };
}): ApifyPost {
  classifications.set(opts.text, {
    isJobPost: true,
    seniority: "mid",
    remoteMode: "in_office",
    techStack: [],
    description: [],
    ...opts.cls,
  });
  return {
    url: opts.url,
    text: opts.text,
    author: { name: "Someone", headline: opts.headline },
    posted_at: { timestamp: daysAgo(opts.daysAgo ?? 1) },
  };
}

beforeEach(() => {
  db.jobs = [];
  db.nextId = 1;
  classifications.clear();
  delete process.env.INGEST_ROLE_FAMILIES;
});

describe("ingestPosts quality gates", () => {
  it("creates zero jobs for the seven production junk posts and reports why", async () => {
    const posts: ApifyPost[] = [
      post({
        url: "https://linkedin.com/posts/phonepe-1",
        text: "PhonePe is hiring a State Head - Sales for Karnataka. Apply now.",
        headline: "Talent Acquisition @ PhonePe",
        cls: { title: "State Head - Sales", roleFamily: "sales" },
      }),
      post({
        url: "https://linkedin.com/posts/swiggy-1",
        text: "Swiggy is hiring CA Industrial Trainees. Great learning opportunity.",
        headline: "Finance Hiring | Swiggy",
        cls: { title: "CA Industrial Trainee", roleFamily: "finance" },
      }),
      post({
        url: "https://linkedin.com/posts/swiggy-2",
        text: "We're Hiring | Lead / AM Campus Programs | Swiggy | Bengaluru",
        headline: "Campus Programs | Swiggy",
        cls: { title: "| Swiggy | Bengaluru", roleFamily: "marketing" },
      }),
      post({
        url: "https://linkedin.com/posts/amazon-1",
        text: "Exciting opportunities across Amazon science teams. Reach out to learn more!",
        headline: "Recruiter II - Science | Hiring Applied Scientists/Research Scientists/Data Scientists for Amazon",
        cls: { title: "", roleFamily: "ai_ml" },
      }),
      post({
        url: "https://linkedin.com/posts/amazon-2",
        text: "Amazon science is growing. Ping me if you want to know more about our teams.",
        headline: "Recruiter II - Science | Hiring Applied Scientists/Research Scientists/Data Scientists for Amazon",
        cls: { title: "", roleFamily: "ai_ml" },
      }),
      post({
        url: "https://linkedin.com/posts/sales-eng-1",
        text: "We're hiring a Senior Sales Engineer to partner with our enterprise sales team in Mumbai.",
        headline: "Talent Partner",
        cls: { title: "Senior Sales Engineer to partner with our enterprise sales t", roleFamily: "engineering" },
      }),
      post({
        url: "https://linkedin.com/posts/sales-eng-2",
        text: "We're hiring a Senior Sales Engineer to partner with our enterprise sales team in Delhi.",
        headline: "Talent Partner",
        cls: { title: "Senior Sales Engineer to partner with our enterprise sales t", roleFamily: "engineering" },
      }),
    ];

    const result = await ingestPosts(RECRUITER, posts);
    expect(result.jobsCreated).toBe(0);
    expect(result.jobsSkipped).toBe(7);
    expect(result.skipReasons.off_target).toBe(5);
    expect(result.skipReasons.unparseable).toBe(2);
    expect(db.jobs).toHaveLength(0);
  });

  it("skips the second Baazi Games DevOps post as a near duplicate but keeps the SDE III post", async () => {
    const posts: ApifyPost[] = [
      post({
        url: "https://linkedin.com/posts/baazi-devops-1",
        text: "We're Hiring | DevOps Engineer II | Baazi Games. Kubernetes, AWS, Terraform.",
        headline: "Talent Acquisition | Baazi Games",
        daysAgo: 10,
        cls: { title: "DevOps Engineer II", roleFamily: "engineering", techStack: ["aws", "docker"] },
      }),
      post({
        url: "https://linkedin.com/posts/baazi-devops-2",
        text: "We're Hiring | DevOps Engineer II | Baazi Games. Own our infra and CI/CD.",
        headline: "Talent Acquisition | Baazi Games",
        daysAgo: 2,
        cls: { title: "DevOps Engineer II", roleFamily: "engineering", techStack: ["aws"] },
      }),
      post({
        url: "https://linkedin.com/posts/baazi-sde-1",
        text: "We're Hiring | SDE III – Backend | Baazi Games. Java, distributed systems.",
        headline: "Talent Acquisition | Baazi Games",
        daysAgo: 3,
        cls: { title: "SDE III – Backend", roleFamily: "engineering", techStack: ["java"] },
      }),
    ];

    const result = await ingestPosts(RECRUITER, posts);
    expect(result.jobsCreated).toBe(2);
    expect(result.skipReasons.duplicate).toBe(1);
    expect(db.jobs.map((j) => j.title).sort()).toEqual(["DevOps Engineer II", "SDE III – Backend"]);
    expect(db.jobs.every((j) => j.company === "Baazi Games")).toBe(true);
  });

  it("still dedupes an exact sourceUrl re-scrape and updates an edited post", async () => {
    const first = post({
      url: "https://linkedin.com/posts/databricks-1",
      text: "Databricks is hiring a Staff Software Engineer (Backend). Apply today.",
      headline: "Staff Recruiter at Databricks",
      cls: { title: "Staff Software Engineer (Backend)", roleFamily: "engineering" },
    });
    await ingestPosts(RECRUITER, [first]);
    const again = await ingestPosts(RECRUITER, [first]);
    expect(again.skipReasons.duplicate).toBe(1);
    expect(db.jobs).toHaveLength(1);

    const edited = post({
      url: "https://linkedin.com/posts/databricks-1",
      text: "Databricks is hiring a Staff Software Engineer (Backend). Apply today. Now remote-friendly.",
      headline: "Staff Recruiter at Databricks",
      cls: { title: "Staff Software Engineer (Backend)", roleFamily: "engineering", remoteMode: "remote" },
    });
    const updated = await ingestPosts(RECRUITER, [edited]);
    expect(updated.jobsCreated).toBe(1);
    expect(db.jobs).toHaveLength(1);
    expect(db.jobs[0].remoteMode).toBe("remote");
  });

  it("stores the headline company when the post yields a sentence fragment", async () => {
    const posts = [
      post({
        url: "https://linkedin.com/posts/databricks-2",
        text: "Come work at massive scale and work on the leading Data & AI platform. We are hiring Staff Software Engineers.",
        headline: "Staff Recruiter at Databricks",
        cls: { title: "Staff Software Engineer (Backend)", roleFamily: "engineering" },
      }),
      post({
        url: "https://linkedin.com/posts/google-1",
        text: "Hiring Software Engineer III for our Bengaluru office. DM me.",
        headline: "Senior Recruiter @ Google lEx-JPMorganl lEx-Mindtreel",
        cls: { title: "Software Engineer III", roleFamily: "engineering" },
      }),
    ];
    const result = await ingestPosts(RECRUITER, posts);
    expect(result.jobsCreated).toBe(2);
    expect(db.jobs.map((j) => j.company)).toEqual(["Databricks", "Google"]);
    expect(db.jobs[1].roleBadge).toBe("Software Engineer III @ Google");
  });

  it("keeps the other skip reasons and lets INGEST_ROLE_FAMILIES widen the gate", async () => {
    const noUrl: ApifyPost = { text: "no url here", author: { headline: "" } };
    const notJob = post({
      url: "https://linkedin.com/posts/opinion",
      text: "Do you agree? Views are my own.",
      headline: "",
      cls: { isJobPost: false, title: "", roleFamily: "engineering" },
    });
    const expired = post({
      url: "https://linkedin.com/posts/old",
      text: "We're hiring a Backend Engineer at Zepto.",
      headline: "EM @ Zepto",
      daysAgo: 45,
      cls: { title: "Backend Engineer", roleFamily: "engineering" },
    });
    const data = post({
      url: "https://linkedin.com/posts/data",
      text: "We're hiring a Data Analyst at Zepto.",
      headline: "Analytics Lead @ Zepto",
      cls: { title: "Data Analyst", roleFamily: "data" },
    });

    const strict = await ingestPosts(RECRUITER, [noUrl, notJob, expired, data]);
    expect(strict.skipReasons).toMatchObject({ no_url: 1, not_job: 1, expired: 1, off_target: 1 });
    expect(db.jobs).toHaveLength(0);

    process.env.INGEST_ROLE_FAMILIES = "engineering,data";
    const widened = await ingestPosts(RECRUITER, [data]);
    expect(widened.jobsCreated).toBe(1);
    expect(db.jobs[0].title).toBe("Data Analyst");
  });
});

describe("skip summary", () => {
  it("includes the new reasons in the run-log summary string", async () => {
    const { summarizeSkipReasons } = await import("../src/lib/apify");
    expect(
      summarizeSkipReasons({ no_url: 0, not_job: 1, expired: 0, off_target: 5, unparseable: 2, duplicate: 1 }),
    ).toBe("not_job=1,off_target=5,unparseable=2,duplicate=1");
  });
});
