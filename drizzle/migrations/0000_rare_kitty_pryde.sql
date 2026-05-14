CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"thread_id" text,
	"user_id" text NOT NULL,
	"filename" text NOT NULL,
	"size" integer NOT NULL,
	"type" text NOT NULL,
	"discord_url" text NOT NULL,
	"uploaded_url" text,
	"upload_status" text DEFAULT 'pending' NOT NULL,
	"upload_error" text,
	"created_at" bigint NOT NULL,
	"uploaded_at" bigint
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"thread_id" text,
	"user_id" text NOT NULL,
	"username" text NOT NULL,
	"avatar_url" text,
	"content" text NOT NULL,
	"edited_content" text,
	"created_at" bigint NOT NULL,
	"edited_at" bigint,
	"deleted_at" bigint,
	"type" text DEFAULT 'text' NOT NULL,
	"metadata" text,
	"ai_status" text DEFAULT 'pending' NOT NULL,
	"ai_moderation_flags" text,
	"ai_moderation_score" real,
	"ai_moderation_raw" text,
	"ai_analysis" text,
	"ai_analyzed_at" bigint,
	"ai_error" text
);
--> statement-breakpoint
CREATE TABLE "muxer_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"maxAttempts" integer DEFAULT 3 NOT NULL,
	"createdAt" bigint NOT NULL,
	"updatedAt" bigint NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "ui_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "fk_attachments_message_id" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attachments_channel" ON "attachments" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_attachments_message" ON "attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_attachments_status" ON "attachments" USING btree ("upload_status");--> statement-breakpoint
CREATE INDEX "idx_messages_channel" ON "messages" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_messages_user" ON "messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_messages_created" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_thread" ON "messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "idx_muxer_jobs_status" ON "muxer_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_muxer_jobs_createdAt" ON "muxer_jobs" USING btree ("createdAt");