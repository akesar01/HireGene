import { createHash } from "crypto";
import { prisma } from "./prisma.js";
import { classifyPost } from "./llm-classifier.js";
import { computeExpiresAt, isJobExpired, jobExpiryCutoff } from "./job-expiry.js";
import { inferCompany } from "./extract-company.js";
import { isOpenApifyStatus, parseApifyDataset } from "./apify-parse.js";

export { isOpenApifyStatus, parseApifyDataset } from "./apify-parse.js";

const ACTOR_ID = "atomus~linkedin-posts-scraper-pro";
const MAX_POSTS = 5;
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apifyToken(): string {
  const token = process.env.APIFY_TOKEN || process.env.APIFY_API_KEY;
  if (!token) throw new Error("APIFY_TOKEN is not set");
  return token;
}

function waitMs(): number {
  const parsed = Number(process.env.APIFY_WAIT_MS ?? 180_000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 180_000;
}

function pollEveryMs(): number {
  const parsed = Number(process.env.APIFY_POLL_MS ?? 5_000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5_000;
}

interface ApifyAuthor {
  first_name?: string;
  last_name?: string;
  name?: string;
  headline?: string;
  username?: string;
  profile_url?: string;
  avatar?: string;
  profile_picture?: string;
}

interface ApifyStats {
  total_reactions?: number;
  comments?: number;
  reposts?: number;
}

interface ApifyUrn {
  activity_urn?: string;
  share_urn?: string;
  ugcPost_urn?: string | null;
}

export interface ApifyPost {
  text?: string;
  content?: string;
  url?: string;
  post_url?: string;
  post_type?: string;
  type?: string;
  author?: ApifyAuthor;
  author_name?: string;
  profile_picture?: string;
  stats?: ApifyStats;
  comments?: number;
  reposts?: number;
  total_reactions?: number;
  is_repost?: boolean;
  posted_at?: {
    date?: string;
    timestamp?: number;
    relative?: string;
  } | string;
  reshared_post?: unknown;
  full_urn?: string;
  urn?: string | ApifyUrn;
  posts?: ApifyPost[];
}

export interface ScrapeDetail {
  recruiterId: number;
  apifyRunId: string;
  status: string;
  postsFound: number;
  jobsCreated: number;
  jobsSkipped: number;
  pending?: boolean;
}

export interface ScrapeResult {
  scraped: number;
  jobsCreated: number;
  jobsSkipped: number;
  pending?: boolean;
  details: ScrapeDetail[];
}

export async function scrapeRecruiter(recruiter: {
  id: number;
  name: string;
  linkedinUrl: string;
}): Promise<ScrapeResult> {
  const existing = await findOpenRun(recruiter.id);
  const runId = existing?.apifyRunId ?? (await startApifyRun(recruiter));
  return waitAndIngest(recruiter, runId, waitMs());
}

export async function startApifyRun(recruiter: {
  id: number;
  linkedinUrl: string;
}): Promise<string> {
  const token = apifyToken();
  const startedAt = new Date();
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profiles: [recruiter.linkedinUrl],
        maxPosts: MAX_POSTS,
        postedAfterDate: jobExpiryCutoff().toISOString().split("T")[0],
        sortBy: "date",
        includeSharedPosts: true,
        includeReposts: true,
      }),
    },
  );

  if (!startRes.ok) {
    const errBody = await startRes.text();
    await upsertRunLog({
      recruiterId: recruiter.id,
      apifyRunId: `failed_${Date.now()}_${recruiter.id}`,
      status: "FAILED",
      postsFound: 0,
      jobsCreated: 0,
      jobsSkipped: 0,
      startedAt,
      finishedAt: new Date(),
      errorMsg: `${startRes.status} ${errBody}`,
    });
    throw new Error(`Apify run start failed: ${startRes.status} ${errBody}`);
  }

  const runData = (await startRes.json()) as { data: { id: string } };
  const runId = runData.data.id;
  await upsertRunLog({
    recruiterId: recruiter.id,
    apifyRunId: runId,
    status: "RUNNING",
    postsFound: 0,
    jobsCreated: 0,
    jobsSkipped: 0,
    startedAt,
    finishedAt: null,
  });
  return runId;
}

export async function finishPendingRuns(options: {
  budgetMs?: number;
} = {}): Promise<ScrapeDetail[]> {
  const budgetMs = options.budgetMs ?? waitMs();
  const deadline = Date.now() + budgetMs;
  const open = await prisma.apifyRunLog.findMany({
    where: { status: { in: ["RUNNING", "READY"] } },
    orderBy: { startedAt: "asc" },
  });

  const details: ScrapeDetail[] = [];
  for (const run of open) {
    if (Date.now() >= deadline) break;
    if (!run.recruiterId) continue;
    const recruiter = await prisma.recruiter.findUnique({
      where: { id: run.recruiterId },
      select: { id: true, name: true, linkedinUrl: true },
    });
    if (!recruiter) continue;
    const remaining = Math.max(deadline - Date.now(), pollEveryMs());
    const result = await waitAndIngest(recruiter, run.apifyRunId, remaining);
    details.push(...result.details);
  }
  return details;
}

export async function recruiterIdsWithOpenRuns(): Promise<number[]> {
  const rows = await prisma.apifyRunLog.findMany({
    where: { status: { in: ["RUNNING", "READY"] }, recruiterId: { not: null } },
    select: { recruiterId: true },
  });
  return rows.map((row) => row.recruiterId!).filter((id) => id > 0);
}

async function findOpenRun(recruiterId: number) {
  return prisma.apifyRunLog.findFirst({
    where: { recruiterId, status: { in: ["RUNNING", "READY"] } },
    orderBy: { startedAt: "desc" },
  });
}

export async function waitAndIngest(
  recruiter: { id: number; name: string; linkedinUrl: string },
  runId: string,
  maxWaitMs: number,
): Promise<ScrapeResult> {
  const token = apifyToken();
  const deadline = Date.now() + maxWaitMs;
  let status = "RUNNING";
  let datasetId = "";

  while (Date.now() < deadline) {
    const statusRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/runs/${runId}?token=${token}`,
    );
    if (!statusRes.ok) {
      await sleep(pollEveryMs());
      continue;
    }
    const statusData = (await statusRes.json()) as {
      data: { status: string; defaultDatasetId?: string };
    };
    status = statusData.data.status;
    datasetId = statusData.data.defaultDatasetId ?? datasetId;
    if (status === "SUCCEEDED" || status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      break;
    }
    await sleep(pollEveryMs());
  }

  if (status !== "SUCCEEDED") {
    if (isOpenApifyStatus(status) || status === "RUNNING") {
      await upsertRunLog({
        recruiterId: recruiter.id,
        apifyRunId: runId,
        status: "RUNNING",
        postsFound: 0,
        jobsCreated: 0,
        jobsSkipped: 0,
        startedAt: new Date(),
        finishedAt: null,
        errorMsg: `Still ${status}; will ingest on next cron`,
      });
      return {
        scraped: 1,
        jobsCreated: 0,
        jobsSkipped: 0,
        pending: true,
        details: [{
          recruiterId: recruiter.id,
          apifyRunId: runId,
          status: "RUNNING",
          postsFound: 0,
          jobsCreated: 0,
          jobsSkipped: 0,
          pending: true,
        }],
      };
    }
    await upsertRunLog({
      recruiterId: recruiter.id,
      apifyRunId: runId,
      status: "FAILED",
      postsFound: 0,
      jobsCreated: 0,
      jobsSkipped: 0,
      startedAt: new Date(),
      finishedAt: new Date(),
      errorMsg: `Run status: ${status}`,
    });
    throw new Error(`Apify run did not succeed: ${status}`);
  }

  if (!datasetId) {
    throw new Error(`Apify run ${runId} succeeded with no dataset id`);
  }

  const datasetRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`,
  );
  if (!datasetRes.ok) {
    const errBody = await datasetRes.text();
    await upsertRunLog({
      recruiterId: recruiter.id,
      apifyRunId: runId,
      status: "FAILED",
      postsFound: 0,
      jobsCreated: 0,
      jobsSkipped: 0,
      startedAt: new Date(),
      finishedAt: new Date(),
      errorMsg: `${datasetRes.status} ${errBody}`,
    });
    throw new Error(`Apify dataset fetch failed: ${datasetRes.status} ${errBody}`);
  }

  const posts = parseApifyDataset(await datasetRes.json());
  const { jobsCreated, jobsSkipped } = await ingestPosts(recruiter, posts);

  await upsertRunLog({
    recruiterId: recruiter.id,
    apifyRunId: runId,
    status: "SUCCEEDED",
    postsFound: posts.length,
    jobsCreated,
    jobsSkipped,
    startedAt: new Date(),
    finishedAt: new Date(),
  });
  await prisma.recruiter.update({
    where: { id: recruiter.id },
    data: { lastScrapedAt: new Date() },
  });

  return {
    scraped: 1,
    jobsCreated,
    jobsSkipped,
    details: [{
      recruiterId: recruiter.id,
      apifyRunId: runId,
      status: "SUCCEEDED",
      postsFound: posts.length,
      jobsCreated,
      jobsSkipped,
    }],
  };
}

async function ingestPosts(
  recruiter: { id: number; name: string },
  posts: ApifyPost[],
): Promise<{ jobsCreated: number; jobsSkipped: number }> {
  let jobsCreated = 0;
  let jobsSkipped = 0;

  for (const post of posts) {
    const rawText = post.text ?? post.content ?? "";
    const sourceUrl = post.url ?? post.post_url ?? "";

    if (!sourceUrl) {
      jobsSkipped++;
      continue;
    }

    const authorHeadline = post.author?.headline ?? "";
    const classification = await classifyPost(rawText, authorHeadline);

    if (!classification.isJobPost) {
      jobsSkipped++;
      continue;
    }

    const contentHash = createHash("sha256").update(rawText.trim().toLowerCase()).digest("hex");
    const postedTimestamp = typeof post.posted_at === "object" ? post.posted_at?.timestamp : undefined;
    const postedDateStr = typeof post.posted_at === "object"
      ? post.posted_at?.date
      : (typeof post.posted_at === "string" ? post.posted_at : undefined);
    const postedDate = postedTimestamp
      ? new Date(postedTimestamp)
      : postedDateStr
        ? new Date(postedDateStr)
        : new Date();
    if (isJobExpired(postedDate)) {
      jobsSkipped++;
      continue;
    }

    const expiresAt = computeExpiresAt(postedDate);
    const authorName = post.author
      ? (post.author.name ?? `${post.author.first_name ?? ""} ${post.author.last_name ?? ""}`.trim())
      : post.author_name ?? recruiter.name;
    const authorAvatar = post.author?.avatar ?? post.author?.profile_picture ?? post.profile_picture ?? null;
    const isRepost = post.is_repost ?? (post.post_type === "repost" || post.type === "repost") ?? !!post.reshared_post;
    const company = await resolveJobCompany(authorHeadline, rawText, recruiter.id);
    const existing = await prisma.job.findUnique({ where: { sourceUrl } });

    if (existing) {
      if (existing.contentHash === contentHash) {
        jobsSkipped++;
        continue;
      }
      await prisma.job.update({
        where: { id: existing.id },
        data: {
          rawText,
          contentHash,
          title: classification.title,
          roleFamily: classification.roleFamily as never,
          seniority: classification.seniority as never,
          remoteMode: classification.remoteMode as never,
          stack: classification.techStack as never[],
          description: classification.description,
          company,
          roleBadge: `${classification.title} @ ${company}`,
          authorAvatar,
          commentCount: post.stats?.comments ?? post.comments ?? 0,
          postedAt: postedDate,
          expiresAt,
        },
      });
      jobsCreated++;
      continue;
    }

    await prisma.job.create({
      data: {
        recruiterId: recruiter.id,
        title: classification.title,
        company,
        author: authorName,
        authorTitle: authorHeadline,
        authorAvatar,
        roleBadge: `${classification.title} @ ${company}`,
        source: "linkedin",
        sourceUrl,
        isRepost,
        roleFamily: classification.roleFamily as never,
        seniority: classification.seniority as never,
        remoteMode: classification.remoteMode as never,
        stack: classification.techStack as never[],
        description: classification.description,
        rawText,
        contentHash,
        commentCount: post.stats?.comments ?? post.comments ?? 0,
        postedAt: postedDate,
        expiresAt,
      },
    });
    jobsCreated++;
  }

  return { jobsCreated, jobsSkipped };
}

async function resolveJobCompany(
  headline: string,
  rawText: string,
  recruiterId: number,
): Promise<string> {
  const submission = await prisma.recruiterSubmission.findFirst({
    where: { recruiterId, company: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { company: true },
  });
  const sibling = await prisma.job.findFirst({
    where: {
      recruiterId,
      NOT: { company: { equals: "Unknown", mode: "insensitive" } },
    },
    orderBy: { createdAt: "desc" },
    select: { company: true },
  });
  return inferCompany({
    headline,
    rawText,
    fallbacks: [submission?.company, sibling?.company],
  });
}

async function upsertRunLog(row: {
  recruiterId: number;
  apifyRunId: string;
  status: string;
  postsFound: number;
  jobsCreated: number;
  jobsSkipped: number;
  startedAt: Date;
  finishedAt: Date | null;
  errorMsg?: string;
}) {
  await prisma.apifyRunLog.upsert({
    where: { apifyRunId: row.apifyRunId },
    create: {
      recruiterId: row.recruiterId,
      apifyRunId: row.apifyRunId,
      actorId: ACTOR_ID,
      source: "linkedin",
      status: row.status,
      postsFound: row.postsFound,
      jobsCreated: row.jobsCreated,
      jobsSkipped: row.jobsSkipped,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      errorMsg: row.errorMsg ?? null,
    },
    update: {
      status: row.status,
      postsFound: row.postsFound,
      jobsCreated: row.jobsCreated,
      jobsSkipped: row.jobsSkipped,
      finishedAt: row.finishedAt,
      errorMsg: row.errorMsg ?? null,
    },
  });
}
