-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('linkedin', 'x');

-- CreateEnum
CREATE TYPE "RoleFamily" AS ENUM ('engineering', 'ai_ml', 'product', 'design', 'data', 'growth', 'marketing', 'content', 'ops', 'founders_office', 'sales', 'strategy', 'finance', 'business', 'people');

-- CreateEnum
CREATE TYPE "SeniorityLevel" AS ENUM ('intern', 'junior', 'mid', 'senior', 'lead', 'staff', 'head');

-- CreateEnum
CREATE TYPE "RemoteMode" AS ENUM ('in_office', 'remote', 'hybrid');

-- CreateEnum
CREATE TYPE "TechStack" AS ENUM ('python', 'java', 'sql', 'ai', 'aws', 'langchain', 'rag', 'react', 'llm', 'nextjs', 'typescript', 'nodejs', 'go', 'rust', 'docker');

-- CreateTable
CREATE TABLE "recruiters" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "linkedin_url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "scrape_interval_hours" INTEGER NOT NULL DEFAULT 24,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_scraped_at" TIMESTAMP(3),

    CONSTRAINT "recruiters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" SERIAL NOT NULL,
    "recruiter_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "author_title" TEXT NOT NULL,
    "role_badge" TEXT NOT NULL,
    "source" "JobSource" NOT NULL,
    "source_url" TEXT NOT NULL,
    "is_repost" BOOLEAN NOT NULL DEFAULT false,
    "role_family" "RoleFamily" NOT NULL,
    "seniority" "SeniorityLevel" NOT NULL,
    "remote_mode" "RemoteMode" NOT NULL,
    "stack" "TechStack"[],
    "description" TEXT[],
    "raw_text" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "posted_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apify_run_logs" (
    "id" SERIAL NOT NULL,
    "recruiter_id" INTEGER,
    "apify_run_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "source" "JobSource" NOT NULL,
    "status" TEXT NOT NULL,
    "posts_found" INTEGER NOT NULL DEFAULT 0,
    "jobs_created" INTEGER NOT NULL DEFAULT 0,
    "jobs_skipped" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "error_msg" TEXT,

    CONSTRAINT "apify_run_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recruiters_linkedin_url_key" ON "recruiters"("linkedin_url");

-- CreateIndex
CREATE INDEX "recruiters_active_last_scraped_at_idx" ON "recruiters"("active", "last_scraped_at");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_source_url_key" ON "jobs"("source_url");

-- CreateIndex
CREATE INDEX "jobs_expires_at_idx" ON "jobs"("expires_at");

-- CreateIndex
CREATE INDEX "jobs_source_role_family_seniority_remote_mode_idx" ON "jobs"("source", "role_family", "seniority", "remote_mode");

-- CreateIndex
CREATE INDEX "jobs_comment_count_idx" ON "jobs"("comment_count" DESC);

-- CreateIndex
CREATE INDEX "jobs_posted_at_idx" ON "jobs"("posted_at" DESC);

-- CreateIndex
CREATE INDEX "jobs_recruiter_id_idx" ON "jobs"("recruiter_id");

-- CreateIndex
CREATE UNIQUE INDEX "apify_run_logs_apify_run_id_key" ON "apify_run_logs"("apify_run_id");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "recruiters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apify_run_logs" ADD CONSTRAINT "apify_run_logs_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "recruiters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
