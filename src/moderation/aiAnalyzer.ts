import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Piscina } from "piscina";
import { config } from "../config.js";
import { createChildLogger } from "../logger.js";
import { retryWithBackoff } from "../retry.js";
import {
  buildConversationContext,
  estimateTokens,
  formatMessageForPrompt,
} from "./conversationContext.js";
import { runModerationAnalysis } from "./llmModerationClient.js";
import {
  getAttachmentsForMessages,
  getConversationContextBefore,
  getMessageById,
  getPendingConversationKeys,
  getPendingMessagesByConversation,
  updateMessagesAIAnalysisBulk,
} from "./messageStore.js";
import type {
  AnalysisQueueStatus,
  MessageRecord,
  ModerationBroadcaster,
} from "./types.js";

const logger = createChildLogger("ai-analyzer");

type ModerationGlobal = typeof globalThis & {
  moderationBroadcaster?: ModerationBroadcaster;
};

function getModerationBroadcaster(): ModerationBroadcaster | undefined {
  return (globalThis as ModerationGlobal).moderationBroadcaster;
}

// Debounce state per conversation key
const conversationDebounceTimers = new Map<string, NodeJS.Timeout>();
// Track conversations currently being processed
const conversationProcessing = new Map<string, number>();
// Track conversations in error cooldown (failed recently)
const conversationErrorCooldown = new Map<string, number>();

const AI_PROCESSING_OVERLAP_MS = 30000;

let activeRequests = 0;
let lastError: string | null = null;

// Global circuit breaker state
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;
let globalCooldownUntil = 0;

// ---------------------------------------------------------------------------
// Individual fallback queue — runs PARALLEL to the batch pipeline.
//
// When a batch LLM call returns but some message IDs are absent from the
// response (analysis_incomplete), those IDs are enqueued here.  Each message
// is processed independently and concurrently: there is no serialisation
// per-conversation, and a dedup Set prevents the same ID being in-flight twice.
// ---------------------------------------------------------------------------

/** IDs currently being processed one-by-one (in-flight or waiting to start). */
const individualInFlight = new Set<string>();

/** Counter for observability (mirrors activeRequests but for individual path). */
let activeIndividualRequests = 0;

function getAnalysisWorkerUrl(): URL {
  const candidates = [
    new URL("./aiAnalysisWorker.js", import.meta.url),
    new URL("../aiAnalysisWorker.js", import.meta.url),
    new URL("./aiAnalysisWorker.ts", import.meta.url),
  ];

  for (const candidate of candidates) {
    if (existsSync(fileURLToPath(candidate))) {
      return candidate;
    }
  }

  return candidates[2];
}

const workerPool = new Piscina({
  filename: fileURLToPath(getAnalysisWorkerUrl()),
  execArgv: process.execArgv,
});

interface AnalysisWorkerResponse {
  ok: boolean;
  conversationKey: string;
  rows: MessageRecord[];
  error?: string;
}

/**
 * Gets the conversation key for a message (thread_id or channel_id)
 */
export function getConversationKey(message: MessageRecord): string {
  return message.thread_id || message.channel_id;
}

/**
 * Picks a batch of messages within token budget
 */
export function pickBatchWithinBudget(
  messages: MessageRecord[],
  maxTokens: number,
  tokensPerMessage: number,
): MessageRecord[] {
  const batch: MessageRecord[] = [];
  let usedTokens = 0;

  for (const msg of messages) {
    const formatted = formatMessageForPrompt(msg, "target");
    const msgTokens = estimateTokens(formatted) + tokensPerMessage;

    if (usedTokens + msgTokens <= maxTokens) {
      batch.push(msg);
      usedTokens += msgTokens;
    }
  }

  return batch;
}

function isConversationProcessingLocked(conversationKey: string): boolean {
  const startedAt = conversationProcessing.get(conversationKey);
  return Boolean(
    startedAt && Date.now() - startedAt < AI_PROCESSING_OVERLAP_MS,
  );
}

/**
 * Processes a batch of messages for a conversation
 */
/**
 * Processes a single message through the LLM moderation pipeline directly
 * (no worker pool — avoids IPC overhead for a single-item call).  Called from
 * the individual fallback queue; never from the batch path.
 */
async function processIndividualFallback(
  message: MessageRecord,
): Promise<void> {
  const { id: messageId } = message;
  activeIndividualRequests++;
  try {
    const contextBefore = await getConversationContextBefore({
      channelId: message.channel_id,
      threadId: message.thread_id,
      beforeCreatedAt: message.created_at,
      limit: config.AI_ANALYSIS_CONTEXT_MESSAGE_LIMIT,
    });

    const contextLines = buildConversationContext({
      contextBefore,
      targets: [message],
      maxTokens: config.AI_ANALYSIS_MAX_CONTEXT_TOKENS,
    });

    const contextIds = contextBefore.map((m) => m.id);
    const attachments = await getAttachmentsForMessages([
      messageId,
      ...contextIds,
    ]);

    const analysisResult = await retryWithBackoff(
      () =>
        runModerationAnalysis({
          targets: [message],
          contextText: contextLines.join("\n"),
          attachments,
        }),
      {
        retries: 2,
        minTimeout: 2000,
        maxTimeout: 15000,
        logger,
      },
    );

    const updates = analysisResult.results.map((r) => ({
      messageId: r.messageId,
      result: {
        status: r.status,
        flags: JSON.stringify(r.flags),
        score: r.score,
        raw: JSON.stringify(analysisResult.raw),
        analysis: r.analysis,
        analyzedAt: Date.now(),
        error: null,
      },
    }));

    const rows = await updateMessagesAIAnalysisBulk(updates);
    for (const row of rows) {
      getModerationBroadcaster()?.messageAnalyzed(row);
    }

    logger.info(
      { messageId, status: analysisResult.results[0]?.status },
      "Individual fallback analysis complete",
    );
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    logger.error(
      {
        messageId,
        error: lastError,
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Individual fallback analysis failed",
    );
  } finally {
    activeIndividualRequests--;
    individualInFlight.delete(messageId);
  }
}

/**
 * Fans out a list of message records to the individual fallback queue.
 * Each message starts processing concurrently (fire-and-forget per message).
 * De-duplicated by message ID so no double-processing even if called repeatedly.
 */
function enqueueIndividualFallbacks(messages: MessageRecord[]): void {
  const newMessages = messages.filter((m) => !individualInFlight.has(m.id));
  if (newMessages.length === 0) return;

  logger.info(
    {
      count: newMessages.length,
      messageIds: newMessages.map((m) => m.id),
    },
    "Enqueueing individual fallback analysis for batch-incomplete messages",
  );

  for (const msg of newMessages) {
    individualInFlight.add(msg.id);
    // Fire-and-forget: each message runs concurrently, errors are handled inside.
    processIndividualFallback(msg).catch((err) => {
      // Belt-and-suspenders: processIndividualFallback catches internally,
      // but guard against any uncaught rejection bubbling here.
      logger.error(
        { messageId: msg.id, error: String(err) },
        "Unexpected error in individual fallback promise",
      );
      individualInFlight.delete(msg.id);
    });
  }
}

async function processBatch(
  conversationKey: string,
  messages: MessageRecord[],
): Promise<void> {
  if (messages.length === 0) return;
  if (Date.now() < globalCooldownUntil) {
    // Should not normally hit here due to checks in scheduleConversationAnalysis, but just in case
    return;
  }

  activeRequests++;
  let shouldScheduleNext = false;
  const processingStartedAt = Date.now();
  conversationProcessing.set(conversationKey, processingStartedAt);
  try {
    const result = (await workerPool.run({
      conversationKey,
      messages,
    })) as AnalysisWorkerResponse;

    for (const row of result.rows) {
      getModerationBroadcaster()?.messageAnalyzed(row);
    }

    if (!result.ok) {
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        globalCooldownUntil = Date.now() + 60000;
        logger.warn(
          "Global circuit breaker triggered due to consecutive errors",
        );
      }

      // Batch failed entirely — fall back all messages to individual queue
      // so no message is permanently lost behind a cooldown.
      logger.warn(
        {
          conversationKey,
          messageCount: messages.length,
          error: result.error,
        },
        "Batch failed entirely — routing all messages to individual fallback queue",
      );
      enqueueIndividualFallbacks(messages);

      lastError = result.error ?? "Analysis worker failed";
      conversationErrorCooldown.set(
        conversationKey,
        Date.now() + config.AI_ANALYSIS_ERROR_COOLDOWN_MS,
      );
      logger.error(
        {
          conversationKey,
          error: lastError,
          messageCount: messages.length,
          messageIds: messages.map((m) => m.id),
          cooldownUntil: new Date(
            Date.now() + config.AI_ANALYSIS_ERROR_COOLDOWN_MS,
          ).toISOString(),
          timestamp: new Date().toISOString(),
        },
        "Batch analysis failed, will retry after cooldown",
      );
      return;
    }

    // Batch succeeded — but check for messages the LLM silently dropped.
    // Rows with flag "analysis_incomplete" were produced by parseModerationResponse
    // as synthetic errors; they must be re-processed individually.
    const incompleteMessages = messages.filter((msg) => {
      const row = result.rows.find((r) => r.id === msg.id);
      if (!row) {
        // The DB update row is missing entirely — treat as incomplete.
        return true;
      }
      const flags: string[] = (() => {
        try {
          return JSON.parse(row.ai_moderation_flags ?? "[]") as string[];
        } catch {
          return [];
        }
      })();
      return row.ai_status === "error" && flags.includes("analysis_incomplete");
    });

    if (incompleteMessages.length > 0) {
      logger.warn(
        {
          conversationKey,
          incompleteCount: incompleteMessages.length,
          incompleteIds: incompleteMessages.map((m) => m.id),
          totalBatchSize: messages.length,
        },
        "Batch returned incomplete results — fanning out to individual fallback queue",
      );
      enqueueIndividualFallbacks(incompleteMessages);
    }

    consecutiveErrors = 0; // Reset circuit breaker
    conversationErrorCooldown.delete(conversationKey);
    shouldScheduleNext = true;
  } catch (error) {
    consecutiveErrors++;
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      globalCooldownUntil = Date.now() + 60000;
      logger.warn("Global circuit breaker triggered due to consecutive errors");
    }

    // Unhandled exception — route everything to individual fallback.
    logger.warn(
      { conversationKey, messageCount: messages.length },
      "Batch threw exception — routing all messages to individual fallback queue",
    );
    enqueueIndividualFallbacks(messages);

    lastError = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    conversationErrorCooldown.set(
      conversationKey,
      Date.now() + config.AI_ANALYSIS_ERROR_COOLDOWN_MS,
    );
    logger.error(
      {
        conversationKey,
        error: lastError,
        stack: errorStack,
        messageCount: messages.length,
        messageIds: messages.map((m) => m.id),
        cooldownUntil: new Date(
          Date.now() + config.AI_ANALYSIS_ERROR_COOLDOWN_MS,
        ).toISOString(),
        timestamp: new Date().toISOString(),
      },
      "Analysis worker failed, will retry after cooldown",
    );
  } finally {
    activeRequests--;
    if (conversationProcessing.get(conversationKey) === processingStartedAt) {
      conversationProcessing.delete(conversationKey);
    }
    if (shouldScheduleNext) {
      setImmediate(() => scheduleConversationAnalysis(conversationKey));
    }
  }
}

/**
 * Debounced analysis trigger for a conversation
 */
function scheduleConversationAnalysis(conversationKey: string): void {
  // Skip if already processing
  if (isConversationProcessingLocked(conversationKey)) {
    return;
  }

  // Check cooldowns
  const convoCooldown = conversationErrorCooldown.get(conversationKey) || 0;
  const activeCooldown = Math.max(convoCooldown, globalCooldownUntil);

  if (activeCooldown && Date.now() < activeCooldown) {
    // Instead of dropping, re-schedule for after cooldown if not already scheduled
    if (!conversationDebounceTimers.has(conversationKey)) {
      const remaining = activeCooldown - Date.now();
      const timer = setTimeout(() => {
        conversationDebounceTimers.delete(conversationKey);
        scheduleConversationAnalysis(conversationKey);
      }, remaining + 500); // 500ms buffer after cooldown
      conversationDebounceTimers.set(conversationKey, timer);
    }
    return;
  }

  // Clear existing timer
  const existingTimer = conversationDebounceTimers.get(conversationKey);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Always use shorter debounce for immediate processing (no concurrency limit)
  const debounceTime = config.AI_ANALYSIS_DEBOUNCE_MS;

  // Set new debounced timer
  const timer = setTimeout(async () => {
    conversationDebounceTimers.delete(conversationKey);

    // Get pending messages for this conversation
    const messages = await getPendingMessagesByConversation(
      conversationKey,
      config.AI_ANALYSIS_MAX_BATCH_SIZE,
    );

    if (messages.length > 0) {
      await processBatch(conversationKey, messages);
    }
  }, debounceTime);

  conversationDebounceTimers.set(conversationKey, timer);
}

/**
 * Queues a message for analysis (debounced by conversation)
 */
export async function queueMessageAnalysis(messageId: string): Promise<void> {
  if (!config.AI_ANALYSIS_ENABLED) return;

  try {
    // Look up the message to get its conversation key
    const message = await getMessageById(messageId);
    if (!message) {
      logger.warn({ messageId }, "Message not found for analysis queue");
      return;
    }

    // Schedule its conversation for analysis
    const conversationKey = getConversationKey(message);
    queueConversationAnalysis(conversationKey);
  } catch (error) {
    logger.error(
      {
        messageId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to queue message for analysis",
    );
  }
}

/**
 * Queues a conversation for analysis (debounced)
 */
export function queueConversationAnalysis(conversationKey: string): void {
  if (!config.AI_ANALYSIS_ENABLED) return;

  // Schedule debounced analysis
  scheduleConversationAnalysis(conversationKey);
}

/**
 * Gets current analysis queue status
 */
export function getAnalysisQueueStatus(): AnalysisQueueStatus {
  return {
    queuedConversations: conversationDebounceTimers.size,
    activeRequests,
    activeIndividualRequests,
    individualInFlightCount: individualInFlight.size,
    lastError,
  };
}

/**
 * Starts the pending AI analysis recovery worker
 */
export function startPendingAIAnalysisWorker(): void {
  if (!config.AI_ANALYSIS_ENABLED) return;

  setInterval(async () => {
    try {
      // Get pending conversation keys
      const conversationKeys = await getPendingConversationKeys(100);

      for (const key of conversationKeys) {
        // Skip if already scheduled
        if (conversationDebounceTimers.has(key)) {
          continue;
        }

        // Skip if currently processing
        if (isConversationProcessingLocked(key)) {
          continue;
        }

        // Skip if in error cooldown
        const cooldownUntil = conversationErrorCooldown.get(key);
        if (cooldownUntil && Date.now() < cooldownUntil) {
          continue;
        }

        scheduleConversationAnalysis(key);
      }
    } catch (error) {
      logger.error({ error }, "Pending AI analysis recovery worker failed");
    }
  }, config.AI_ANALYSIS_RECOVERY_INTERVAL_MS);
}
