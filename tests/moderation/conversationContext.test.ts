import { describe, expect, it } from "vitest";
import { buildConversationPromptMessages } from "../../src/moderation/conversationContext";
import type { MessageRecord } from "../../src/moderation/types";

function message(
  id: string,
  content: string,
  created_at: number,
): MessageRecord {
  return {
    id,
    guild_id: "g1",
    channel_id: "c1",
    thread_id: null,
    user_id: `u-${id}`,
    username: `user-${id}`,
    avatar_url: null,
    content,
    edited_content: null,
    created_at,
    edited_at: null,
    deleted_at: null,
    type: "text",
    metadata: null,
    ai_status: "pending",
  };
}

describe("buildConversationPromptMessages", () => {
  it("marks target messages and keeps chronological order", () => {
    const lines = buildConversationPromptMessages({
      contextBefore: [message("a", "hello", 1)],
      targets: [message("b", "bad?", 2)],
      maxTokens: 1000,
    });

    expect(lines).toContain(
      "[context] id=a time=1970-01-01T00:00:00.001Z user=user-a: hello",
    );
    expect(lines).toContain(
      "[target] id=b time=1970-01-01T00:00:00.002Z user=user-b: bad?",
    );

    const indexA = lines.findIndex((line) => line.includes("id=a"));
    const indexB = lines.findIndex((line) => line.includes("id=b"));
    expect(indexA).toBeLessThan(indexB);
  });

  it("uses edited content when present", () => {
    const target = message("b", "original", 2);
    target.edited_content = "edited";

    const lines = buildConversationPromptMessages({
      contextBefore: [],
      targets: [target],
      maxTokens: 1000,
    });

    expect(lines.some((line) => line.includes("edited"))).toBe(true);
    expect(lines.some((line) => line.includes("original"))).toBe(false);
  });

  it("empty targets returns only fitting context or empty string if no context", () => {
    // Case 1: No context, no targets
    const lines1 = buildConversationPromptMessages({
      contextBefore: [],
      targets: [],
      maxTokens: 1000,
    });
    expect(lines1).toEqual([]);

    // Case 2: Context but no targets
    const lines2 = buildConversationPromptMessages({
      contextBefore: [message("a", "hello", 1)],
      targets: [],
      maxTokens: 1000,
    });
    expect(lines2).toHaveLength(1);
    expect(lines2[0]).toContain("[context]");
  });

  it("maxTokens budget includes target lines even when targets exceed budget", () => {
    // Create targets that exceed budget
    const longContent = "x".repeat(500); // ~125 tokens
    const targets = [
      message("t1", longContent, 1),
      message("t2", longContent, 2),
      message("t3", longContent, 3),
    ];

    const lines = buildConversationPromptMessages({
      contextBefore: [message("c1", "context", 0)],
      targets,
      maxTokens: 200, // Only 200 tokens, but targets alone are ~375
    });

    // All targets should be included
    expect(lines.some((line) => line.includes("id=t1"))).toBe(true);
    expect(lines.some((line) => line.includes("id=t2"))).toBe(true);
    expect(lines.some((line) => line.includes("id=t3"))).toBe(true);

    // Context should be excluded due to budget
    expect(lines.some((line) => line.includes("id=c1"))).toBe(false);
  });

  it("most recent context is kept when context budget is tight", () => {
    // Create multiple context messages with different timestamps
    // Use longer content to ensure they consume meaningful tokens
    const contextBefore = [
      message(
        "c1",
        "oldest context with some extra words to make it longer",
        1000,
      ),
      message(
        "c2",
        "middle context with some extra words to make it longer",
        2000,
      ),
      message(
        "c3",
        "newest context with some extra words to make it longer",
        3000,
      ),
    ];

    const lines = buildConversationPromptMessages({
      contextBefore,
      targets: [message("t1", "target message", 4000)],
      maxTokens: 90, // Very tight budget: target ~35 tokens, room for ~55 tokens of context (fits only c3)
    });

    // Should include target
    expect(lines.some((line) => line.includes("id=t1"))).toBe(true);

    // Should include newest context (c3) but not oldest (c1)
    // With tight budget, only the most recent context should fit
    expect(lines.some((line) => line.includes("id=c3"))).toBe(true);
    expect(lines.some((line) => line.includes("id=c1"))).toBe(false);

    // Verify chronological order is maintained
    const indexT1 = lines.findIndex((line) => line.includes("id=t1"));
    const indexC3 = lines.findIndex((line) => line.includes("id=c3"));
    expect(indexC3).toBeLessThan(indexT1); // context before target
  });
});
