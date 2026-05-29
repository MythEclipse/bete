import { formatMediaEvidenceForPrompt } from "./messageMetadata.js";
import type { MessageRecord } from "./types.js";

export interface ConversationContextInput {
  contextBefore: MessageRecord[];
  targets: MessageRecord[];
  maxTokens: number;
}

/**
 * Formats a timestamp to ISO 8601 string
 */
function formatTimestamp(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Estimates token count for a string (pessimistic approximation for Indonesian slang & JSON overhead)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3) + 15;
}

/**
 * Formats a single message for context or target display
 */
export function formatMessageForPrompt(
  msg: MessageRecord,
  label: "context" | "target",
): string {
  const content = msg.edited_content ?? msg.content;
  const timestamp = formatTimestamp(msg.created_at);
  const mediaEvidence = formatMediaEvidenceForPrompt(msg.metadata);
  const mediaSuffix = mediaEvidence ? ` ${mediaEvidence}` : "";
  return `[${label}] id=${msg.id} time=${timestamp} user=${msg.username}: ${content}${mediaSuffix}`;
}

/**
 * Builds conversation historical context without including targets.
 * Calculates how much token budget targets use, and fills the rest with context.
 */
export function buildConversationContext(
  input: ConversationContextInput,
): string[] {
  const { contextBefore, targets, maxTokens } = input;

  // Calculate tokens used by targets
  let usedTokens = targets.reduce((sum, msg) => {
    return sum + estimateTokens(formatMessageForPrompt(msg, "target"));
  }, 0);

  const selectedContextLines: string[] = [];

  // Go backwards through context, taking most recent first
  for (let i = contextBefore.length - 1; i >= 0; i--) {
    const msg = contextBefore[i];
    const line = formatMessageForPrompt(msg, "context");
    const lineTokens = estimateTokens(line);

    if (usedTokens + lineTokens <= maxTokens) {
      // Unshift so oldest context is first in the array
      selectedContextLines.unshift(line);
      usedTokens += lineTokens;
    }
  }

  return selectedContextLines;
}
