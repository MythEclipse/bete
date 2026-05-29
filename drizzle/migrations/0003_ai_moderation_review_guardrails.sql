ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_categories" text;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_severity" text;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_confidence" real;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_recommended_action" text;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_policy_version" text;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_evidence" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_reviews" (
  "id" text PRIMARY KEY NOT NULL,
  "message_id" text NOT NULL,
  "guild_id" text NOT NULL,
  "channel_id" text NOT NULL,
  "reviewer_id" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "notes" text,
  "created_at" bigint NOT NULL,
  "reviewed_at" bigint
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_message_reviews_message_id" ON "message_reviews" USING btree ("message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_message_reviews_guild_status" ON "message_reviews" USING btree ("guild_id", "status", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "moderation_actions" (
  "id" text PRIMARY KEY NOT NULL,
  "message_id" text,
  "user_id" text,
  "guild_id" text NOT NULL,
  "action_type" text NOT NULL,
  "reason" text,
  "executed_by" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "error" text,
  "created_at" bigint NOT NULL,
  "executed_at" bigint
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_moderation_actions_message_id" ON "moderation_actions" USING btree ("message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_moderation_actions_user_id" ON "moderation_actions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_moderation_actions_status" ON "moderation_actions" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_moderation_actions_guild_status" ON "moderation_actions" USING btree ("guild_id", "status", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "retention_policies" (
  "id" text PRIMARY KEY NOT NULL,
  "guild_id" text NOT NULL,
  "channel_id" text,
  "retention_days" integer DEFAULT 90 NOT NULL,
  "apply_to_media" boolean DEFAULT true NOT NULL,
  "apply_to_voice" boolean DEFAULT true NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_retention_policies_guild_id" ON "retention_policies" USING btree ("guild_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_retention_policies_enabled" ON "retention_policies" USING btree ("enabled");
