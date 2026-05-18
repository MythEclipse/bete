CREATE TABLE "voice_recordings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"username" text NOT NULL,
	"avatar_url" text,
	"guild_id" text,
	"channel_id" text,
	"channel_name" text,
	"filename" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"download_url" text,
	"upload_status" text DEFAULT 'pending' NOT NULL,
	"upload_error" text,
	"created_at" bigint NOT NULL,
	"uploaded_at" bigint
);
--> statement-breakpoint
CREATE INDEX "idx_voice_recordings_user_id" ON "voice_recordings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_voice_recordings_channel_id" ON "voice_recordings" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_voice_recordings_created_at" ON "voice_recordings" USING btree ("created_at");