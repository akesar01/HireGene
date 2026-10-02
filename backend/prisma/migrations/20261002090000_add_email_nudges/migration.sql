-- CreateEnum
CREATE TYPE "EmailFrequency" AS ENUM ('weekly', 'daily');

-- CreateEnum
CREATE TYPE "CampaignKind" AS ENUM ('weekly', 'daily', 'manual', 'experiment');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'running', 'completed');

-- CreateEnum
CREATE TYPE "SendStatus" AS ENUM ('queued', 'dry_run', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'skipped', 'holdout');

-- CreateTable
CREATE TABLE "email_preferences" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT,
    "subscribed" BOOLEAN NOT NULL DEFAULT true,
    "frequency" "EmailFrequency" NOT NULL DEFAULT 'weekly',
    "paused_until" TIMESTAMP(3),
    "unsubscribed_at" TIMESTAMP(3),
    "unsubscribe_reason" TEXT,
    "unsubscribe_token" TEXT NOT NULL,
    "last_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CampaignKind" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "job_count" INTEGER NOT NULL DEFAULT 5,
    "created_by" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_variants" (
    "id" SERIAL NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "is_holdout" BOOLEAN NOT NULL DEFAULT false,
    "subject" TEXT,
    "intro" TEXT,
    "job_count" INTEGER,

    CONSTRAINT "campaign_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nudge_sends" (
    "id" TEXT NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "variant_id" INTEGER,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "SendStatus" NOT NULL,
    "provider_message_id" TEXT,
    "job_ids" INTEGER[],
    "subject" TEXT,
    "error" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "clicked_at" TIMESTAMP(3),
    "bounced_at" TIMESTAMP(3),
    "complained_at" TIMESTAMP(3),
    "unsubscribed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nudge_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nudge_clicks" (
    "id" SERIAL NOT NULL,
    "send_id" TEXT NOT NULL,
    "job_id" INTEGER,
    "source" TEXT NOT NULL,
    "url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nudge_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_events" (
    "id" SERIAL NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message_id" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_preferences_user_id_key" ON "email_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_preferences_unsubscribe_token_key" ON "email_preferences"("unsubscribe_token");

-- CreateIndex
CREATE INDEX "email_preferences_subscribed_frequency_idx" ON "email_preferences"("subscribed", "frequency");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_key_key" ON "campaigns"("key");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_variants_campaign_id_key_key" ON "campaign_variants"("campaign_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "nudge_sends_provider_message_id_key" ON "nudge_sends"("provider_message_id");

-- CreateIndex
CREATE INDEX "nudge_sends_user_id_idx" ON "nudge_sends"("user_id");

-- CreateIndex
CREATE INDEX "nudge_sends_status_idx" ON "nudge_sends"("status");

-- CreateIndex
CREATE UNIQUE INDEX "nudge_sends_campaign_id_user_id_key" ON "nudge_sends"("campaign_id", "user_id");

-- CreateIndex
CREATE INDEX "nudge_clicks_send_id_idx" ON "nudge_clicks"("send_id");

-- CreateIndex
CREATE INDEX "nudge_clicks_job_id_idx" ON "nudge_clicks"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_events_provider_event_id_key" ON "email_events"("provider_event_id");

-- CreateIndex
CREATE INDEX "email_events_message_id_idx" ON "email_events"("message_id");

-- AddForeignKey
ALTER TABLE "campaign_variants" ADD CONSTRAINT "campaign_variants_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nudge_sends" ADD CONSTRAINT "nudge_sends_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nudge_sends" ADD CONSTRAINT "nudge_sends_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "campaign_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nudge_clicks" ADD CONSTRAINT "nudge_clicks_send_id_fkey" FOREIGN KEY ("send_id") REFERENCES "nudge_sends"("id") ON DELETE CASCADE ON UPDATE CASCADE;

