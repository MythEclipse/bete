import { useCallback, useState } from "react";

export type ReviewStatus = "pending" | "approved" | "rejected" | "escalated";

export interface MessageReview {
  id: string;
  message_id: string;
  guild_id: string;
  channel_id: string;
  reviewer_id: string | null;
  status: ReviewStatus;
  notes: string | null;
  created_at: number;
  reviewed_at: number | null;
}

export type ModerationActionType =
  | "delete_message"
  | "mute_user"
  | "warn_user"
  | "kick_user"
  | "ban_user";

export interface ModerationAction {
  id: string;
  message_id: string | null;
  user_id: string | null;
  guild_id: string;
  action_type: ModerationActionType;
  reason: string | null;
  executed_by: string | null;
  status: "pending" | "executed" | "failed";
  error: string | null;
  created_at: number;
  executed_at: number | null;
}

interface ReviewQuery {
  guildId?: string;
  channelId?: string;
  status?: string[];
  cursor?: string;
  limit: number;
}

interface PageResult<T> {
  data: T[];
  nextCursor: string | null;
}

export function useReview() {
  const [reviews, setReviews] = useState<MessageReview[]>([]);
  const [actions, setActions] = useState<ModerationAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const listReviews = useCallback(async (query: ReviewQuery) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.guildId) params.append("guildId", query.guildId);
      if (query.channelId) params.append("channelId", query.channelId);
      if (query.status?.length) params.append("status", query.status.join(","));
      if (query.cursor) params.append("cursor", query.cursor);
      params.append("limit", String(query.limit));

      const response = await fetch(`/api/reviews?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = (await response.json()) as PageResult<MessageReview>;
      setReviews(result.data);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const createReview = useCallback(
    async (review: Omit<MessageReview, "id" | "created_at">) => {
      try {
        const response = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(review),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const newReview = (await response.json()) as MessageReview;
        setReviews((prev) => [newReview, ...prev]);
        return newReview;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        throw err;
      }
    },
    [],
  );

  const updateReview = useCallback(
    async (
      id: string,
      updates: Partial<Omit<MessageReview, "id" | "created_at">>,
    ) => {
      try {
        const response = await fetch(`/api/reviews/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const updated = (await response.json()) as MessageReview;
        setReviews((prev) =>
          prev.map((r) => (r.id === id ? updated : r)),
        );
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        throw err;
      }
    },
    [],
  );

  const listActions = useCallback(
    async (query: Omit<ReviewQuery, "channelId">) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query.guildId) params.append("guildId", query.guildId);
        if (query.status?.length) params.append("status", query.status.join(","));
        if (query.cursor) params.append("cursor", query.cursor);
        params.append("limit", String(query.limit));

        const response = await fetch(`/api/actions?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = (await response.json()) as PageResult<ModerationAction>;
        setActions(result.data);
        setNextCursor(result.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const createAction = useCallback(
    async (
      action: Omit<ModerationAction, "id" | "created_at">,
    ) => {
      try {
        const response = await fetch("/api/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const newAction = (await response.json()) as ModerationAction;
        setActions((prev) => [newAction, ...prev]);
        return newAction;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        throw err;
      }
    },
    [],
  );

  const updateAction = useCallback(
    async (
      id: string,
      updates: Partial<Omit<ModerationAction, "id" | "created_at">>,
    ) => {
      try {
        const response = await fetch(`/api/actions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const updated = (await response.json()) as ModerationAction;
        setActions((prev) =>
          prev.map((a) => (a.id === id ? updated : a)),
        );
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        throw err;
      }
    },
    [],
  );

  return {
    reviews,
    actions,
    loading,
    error,
    nextCursor,
    listReviews,
    createReview,
    updateReview,
    listActions,
    createAction,
    updateAction,
  };
}
