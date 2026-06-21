-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "recruiter_submissions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "linkedin_url" TEXT NOT NULL,
    "title" TEXT,
    "note" TEXT,
    "submitted_by_ip" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'pending',
    "reviewed_at" TIMESTAMP(3),
    "recruiter_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruiter_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recruiter_submissions_status_idx" ON "recruiter_submissions"("status");

-- CreateIndex
CREATE INDEX "recruiter_submissions_linkedin_url_idx" ON "recruiter_submissions"("linkedin_url");
