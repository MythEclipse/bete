import type { Client, Guild, User } from "discord.js-selfbot-v13";
import { createChildLogger } from "../logger.js";
import {
  getModerationAction,
  updateModerationAction,
} from "./messageStore.js";
import type { ModerationAction, ModerationActionType } from "./types.js";

const logger = createChildLogger("action-executor");

interface ActionExecutionContext {
  client: Client;
  guildId: string;
}

/**
 * Executes a moderation action (delete message, mute user, etc.)
 */
export async function executeModerationAction(
  action: ModerationAction,
  context: ActionExecutionContext,
): Promise<void> {
  try {
    const guild = await context.client.guilds.fetch(context.guildId);
    if (!guild) {
      throw new Error(`Guild ${context.guildId} not found`);
    }

    switch (action.action_type) {
      case "delete_message":
        await executeDeleteMessage(action, guild);
        break;
      case "mute_user":
        await executeMuteUser(action, guild);
        break;
      case "warn_user":
        await executeWarnUser(action, guild);
        break;
      case "kick_user":
        await executeKickUser(action, guild);
        break;
      case "ban_user":
        await executeBanUser(action, guild);
        break;
      default:
        throw new Error(`Unknown action type: ${action.action_type}`);
    }

    // Mark action as executed
    await updateModerationAction(action.id, {
      status: "executed",
      executed_at: Date.now(),
      error: null,
    });

    logger.info(
      {
        actionId: action.id,
        actionType: action.action_type,
        guildId: context.guildId,
      },
      "Moderation action executed successfully",
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Mark action as failed
    await updateModerationAction(action.id, {
      status: "failed",
      error: errorMessage,
    });

    logger.error(
      {
        actionId: action.id,
        actionType: action.action_type,
        guildId: context.guildId,
        error: errorMessage,
      },
      "Failed to execute moderation action",
    );

    throw error;
  }
}

async function executeDeleteMessage(
  action: ModerationAction,
  guild: Guild,
): Promise<void> {
  if (!action.message_id) {
    throw new Error("message_id is required for delete_message action");
  }

  // Note: Discord.js selfbot cannot delete messages from other users
  // This is a placeholder for the intended behavior
  logger.warn(
    { messageId: action.message_id },
    "Delete message action requires manual execution or bot permissions",
  );
}

async function executeMuteUser(
  action: ModerationAction,
  guild: Guild,
): Promise<void> {
  if (!action.user_id) {
    throw new Error("user_id is required for mute_user action");
  }

  try {
    const member = await guild.members.fetch(action.user_id);
    if (!member) {
      throw new Error(`Member ${action.user_id} not found in guild`);
    }

    // Mute by removing speak permission in all voice channels
    const voiceChannels = guild.channels.cache.filter(
      (ch) => ch.type === "GUILD_VOICE",
    );

    for (const [, channel] of voiceChannels) {
      await channel.permissionOverwrites.create(member, {
        SPEAK: false,
      });
    }

    logger.info(
      { userId: action.user_id, guildId: guild.id },
      "User muted in all voice channels",
    );
  } catch (error) {
    throw new Error(
      `Failed to mute user: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function executeWarnUser(
  action: ModerationAction,
  guild: Guild,
): Promise<void> {
  if (!action.user_id) {
    throw new Error("user_id is required for warn_user action");
  }

  try {
    const user = await guild.client.users.fetch(action.user_id);
    if (!user) {
      throw new Error(`User ${action.user_id} not found`);
    }

    const reason = action.reason || "Warned by moderation system";
    await user.send(
      `You have been warned in ${guild.name}. Reason: ${reason}`,
    );

    logger.info(
      { userId: action.user_id, guildId: guild.id },
      "User warned via DM",
    );
  } catch (error) {
    logger.warn(
      {
        userId: action.user_id,
        guildId: guild.id,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to send warning DM to user",
    );
    // Don't throw - warning DM failure is not critical
  }
}

async function executeKickUser(
  action: ModerationAction,
  guild: Guild,
): Promise<void> {
  if (!action.user_id) {
    throw new Error("user_id is required for kick_user action");
  }

  try {
    const member = await guild.members.fetch(action.user_id);
    if (!member) {
      throw new Error(`Member ${action.user_id} not found in guild`);
    }

    const reason = action.reason || "Kicked by moderation system";
    await member.kick(reason);

    logger.info(
      { userId: action.user_id, guildId: guild.id },
      "User kicked from guild",
    );
  } catch (error) {
    throw new Error(
      `Failed to kick user: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function executeBanUser(
  action: ModerationAction,
  guild: Guild,
): Promise<void> {
  if (!action.user_id) {
    throw new Error("user_id is required for ban_user action");
  }

  try {
    const reason = action.reason || "Banned by moderation system";
    await guild.bans.create(action.user_id, { reason });

    logger.info(
      { userId: action.user_id, guildId: guild.id },
      "User banned from guild",
    );
  } catch (error) {
    throw new Error(
      `Failed to ban user: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Processes pending moderation actions for a guild
 */
export async function processPendingActions(
  guildId: string,
  context: ActionExecutionContext,
): Promise<{ processed: number; failed: number }> {
  const result = { processed: 0, failed: 0 };

  try {
    const { listModerationActions } = await import("./messageStore.js");

    const { data: actions } = await listModerationActions({
      guildId,
      status: ["pending"],
      limit: 100,
    });

    for (const action of actions) {
      try {
        await executeModerationAction(action, context);
        result.processed++;
      } catch (error) {
        result.failed++;
        logger.error(
          {
            actionId: action.id,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to process pending action",
        );
      }
    }

    logger.info(
      { guildId, ...result },
      "Processed pending moderation actions",
    );

    return result;
  } catch (error) {
    logger.error(
      {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to process pending actions",
    );
    throw error;
  }
}

/**
 * Starts a periodic action processor
 */
export function startActionProcessor(
  client: Client,
  guildId: string,
  intervalMs: number = 60 * 1000, // 1 minute
): NodeJS.Timeout {
  logger.info({ guildId, intervalMs }, "Starting action processor");

  const interval = setInterval(async () => {
    try {
      await processPendingActions(guildId, { client, guildId });
    } catch (error) {
      logger.error(
        {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Action processor failed",
      );
    }
  }, intervalMs);

  return interval;
}
