-- Add composite index for analytics queries: every analytics query filters by
-- guild_id + created_at range + deleted_at IS NULL.
-- This single index covers getHourlyStats, getTopicTrends, getUserLeaderboard,
-- getModerationStats, getActiveChannelCount, and getTopViolators.
CREATE INDEX IF NOT EXISTS "idx_messages_guild_created"
  ON "messages" USING btree ("guild_id", "created_at");

-- Covering index for analytics queries that also filter by ai_status
-- (flagged/warn/clean counts). This speeds up the GROUP BY ai_status aggregates.
CREATE INDEX IF NOT EXISTS "idx_messages_guild_status_created"
  ON "messages" USING btree ("guild_id", "ai_status", "created_at");

-- Composite index for channel-scoped analytics queries
-- Covers channel_id + thread_id OR filters used when a specific channel is selected
CREATE INDEX IF NOT EXISTS "idx_messages_guild_channel_created"
  ON "messages" USING btree ("guild_id", "channel_id", "created_at");
