-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "votes" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "voter_ip" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "votes_job_id_idx" ON "votes"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "votes_job_id_voter_ip_key" ON "votes"("job_id", "voter_ip");

-- CreateIndex
CREATE INDEX "jobs_score_idx" ON "jobs"("score" DESC);

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
