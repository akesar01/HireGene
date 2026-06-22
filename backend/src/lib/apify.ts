import { createHash } from "crypto";
import { prisma } from "./prisma";
import { classifyPost } from "./llm-classifier";
import { JOB_EXPIRY_DAYS } from "./config";

const ACTOR_ID = "atomus~linkedin-posts-scraper-pro";
const EXPIRY_MS = JOB_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
const MAX_POSTS = 5; // Only scrape the 5 most recent posts

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

interface ApifyPost {
  // Shared fields
  text?: string;
  content?: string; // atomus async output uses 'content' instead of 'text'
  url?: string;
  post_url?: string; // atomus async output uses 'post_url' instead of 'url'
  post_type?: string;
  type?: string; // atomus async output uses 'type' for post type
  author?: ApifyAuthor;
  author_name?: string; // atomus async output has flat author_name
  profile_picture?: string; // atomus async output has flat profile_picture
  stats?: ApifyStats;
  comments?: number;
  reposts?: number;
  total_reactions?: number;
  is_repost?: boolean;
  posted_at?: {
    date?: string;
    timestamp?: number;
    relative?: string;
  } | string; // atomus async output has posted_at as ISO string
  reshared_post?: unknown;
  full_urn?: string;
  urn?: string | ApifyUrn;
}

interface ApifyResponse {
  success?: boolean;
  data?: {
    posts?: ApifyPost[];
  };
}

export async function scrapeRecruiter(recruiter: {
  id: number;
  name: string;
  linkedinUrl: string;
}): Promise<{
  scraped: number;
  jobsCreated: number;
  jobsSkipped: number;
  details: Array<{
    recruiterId: number;
    apifyRunId: string;
    status: string;
    postsFound: number;
    jobsCreated: number;
    jobsSkipped: number;
  }>;
}> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");

  const startedAt = new Date();

  // Start async run — sync endpoint returns empty for this actor
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profiles: [recruiter.linkedinUrl],
        maxPosts: MAX_POSTS,
        postedAfterDate: new Date(Date.now() - EXPIRY_MS).toISOString().split("T")[0],
        sortBy: "date",
        includeSharedPosts: true,
        includeReposts: true,
      }),
    },
  );

  if (!startRes.ok) {
    const errBody = await startRes.text();
    await logRun(recruiter.id, "FAILED", 0, 0, 0, startedAt, new Date(), `${startRes.status} ${errBody}`);
    throw new Error(`Apify run start failed: ${startRes.status} ${errBody}`);
  }

  const runData = await startRes.json() as { data: { id: string; defaultDatasetId: string } };
  const runId = runData.data.id;
  const datasetId = runData.data.defaultDatasetId;

  // Poll for completion (max 60 seconds)
  let status = "RUNNING";
  for (let i = 0; i < 20; i++) {
    await sleep(3000);
    const statusRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/runs/${runId}?token=${token}`,
    );
    const statusData = await statusRes.json() as { data: { status: string; defaultDatasetId: string } };
    status = statusData.data.status;
    if (status === "SUCCEEDED" || status === "FAILED") {
      // Update datasetId in case it wasn't in the start response
      if (statusData.data.defaultDatasetId) {
        // datasetId already set from start response
      }
      break;
    }
  }

  if (status !== "SUCCEEDED") {
    await logRun(recruiter.id, "FAILED", 0, 0, 0, startedAt, new Date(), `Run status: ${status}`);
    throw new Error(`Apify run did not succeed: ${status}`);
  }

  // Fetch dataset items using the dataset ID from the run
  const datasetRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`,
  );

  if (!datasetRes.ok) {
    const errBody = await datasetRes.text();
    await logRun(recruiter.id, "FAILED", 0, 0, 0, startedAt, new Date(), `${datasetRes.status} ${errBody}`);
    throw new Error(`Apify dataset fetch failed: ${datasetRes.status} ${errBody}`);
  }

  const rawBody = await datasetRes.json() as ApifyResponse | ApifyPost[];

  let posts: ApifyPost[];
  if (Array.isArray(rawBody)) {
    posts = rawBody;
  } else if (rawBody.data?.posts) {
    posts = rawBody.data.posts;
  } else {
    posts = [];
  }

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

    // LLM classification (falls back to regex if no API key or LLM fails)
    const classification = await classifyPost(rawText, authorHeadline);

    if (!classification.isJobPost) {
      jobsSkipped++;
      continue;
    }

    const contentHash = createHash("sha256").update(rawText.trim().toLowerCase()).digest("hex");

    // Parse posted date — timestamp is in milliseconds, or posted_at may be an ISO string
    const postedTimestamp = typeof post.posted_at === 'object' ? post.posted_at?.timestamp : undefined;
    const postedDateStr = typeof post.posted_at === 'object' ? post.posted_at?.date : (typeof post.posted_at === 'string' ? post.posted_at : undefined);
    const postedDate = postedTimestamp
      ? new Date(postedTimestamp)
      : postedDateStr
        ? new Date(postedDateStr)
        : new Date();
    const expiresAt = new Date(postedDate.getTime() + EXPIRY_MS);

    const authorName = post.author
      ? (post.author.name ?? `${post.author.first_name ?? ""} ${post.author.last_name ?? ""}`.trim())
      : post.author_name ?? recruiter.name;
    const authorAvatar = post.author?.avatar ?? post.author?.profile_picture ?? post.profile_picture ?? null;
    const isRepost = post.is_repost ?? (post.post_type === "repost" || post.type === "repost") ?? !!post.reshared_post;
    const company = extractCompanyFromHeadline(authorHeadline);

    const existing = await prisma.job.findUnique({ where: { sourceUrl } });

    if (existing) {
      if (existing.contentHash === contentHash) {
        jobsSkipped++;
        continue;
      }
      // Post was edited — update
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
          authorAvatar,
          commentCount: post.stats?.comments ?? post.comments ?? 0,
          postedAt: postedDate,
          expiresAt,
        },
      });
      jobsCreated++;
      continue;
    }

    // Insert new job
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

  await logRun(recruiter.id, "SUCCEEDED", posts.length, jobsCreated, jobsSkipped, startedAt, new Date(), undefined, runId);
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

function extractCompanyFromHeadline(headline: string): string {
  const atMatch = headline.match(/@\s*([A-Za-z0-9&. ]+)/);
  if (atMatch) return atMatch[1].trim();
  const atWordMatch = headline.match(/\bat\s+([A-Za-z0-9&. ]+)/);
  if (atWordMatch) return atWordMatch[1].trim();
  return "Unknown";
}

async function logRun(
  recruiterId: number,
  status: string,
  postsFound: number,
  jobsCreated: number,
  jobsSkipped: number,
  startedAt: Date,
  finishedAt: Date,
  errorMsg?: string,
  apifyRunId?: string,
) {
  await prisma.apifyRunLog.create({
    data: {
      recruiterId,
      apifyRunId: apifyRunId ?? `run_${Date.now()}_${recruiterId}`,
      actorId: ACTOR_ID,
      source: "linkedin",
      status,
      postsFound,
      jobsCreated,
      jobsSkipped,
      startedAt,
      finishedAt,
      errorMsg: errorMsg ?? null,
    },
  });
}
