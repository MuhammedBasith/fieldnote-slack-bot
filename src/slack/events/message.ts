import type { App } from "@slack/bolt";
import { env } from "../../config/env.ts";
import { messageService } from "../../services/messageService.ts";
import { logger } from "../../utils/logger.ts";

// Simple type for message events we care about
interface SlackMessage {
  type: string;
  subtype?: string;
  text?: string;
  user?: string;
  channel: string;
  ts: string;
  bot_id?: string;
}

/**
 * Set up the message event handler
 * Listens to all messages in configured channels and stores them
 */
export function setupMessageHandler(app: App) {
  // Listen to all messages using event handler
  app.event("message", async ({ event, client }) => {
    try {
      // Cast to our simple type
      const message = event as unknown as SlackMessage;

      // Type guard: skip message subtypes (edits, deletions, etc.)
      if (message.subtype) {
        return;
      }

      // Skip if no text content
      if (!message.text) {
        return;
      }

      // Only process messages from configured channels
      if (!env.SLACK_CHANNEL_IDS.includes(message.channel)) {
        return;
      }

      // Skip bot messages
      if ("bot_id" in message && message.bot_id) {
        return;
      }

      // Get user info for context
      let userName: string | null = null;
      try {
        if (message.user) {
          const userInfo = await client.users.info({ user: message.user });
          userName =
            userInfo.user?.real_name || userInfo.user?.name || null;
        }
      } catch {
        logger.warn("Could not fetch user info", { userId: message.user });
      }

      // Store message in database
      await messageService.storeMessage({
        channel_id: message.channel,
        user_id: message.user || "unknown",
        user_name: userName,
        text: message.text,
        slack_ts: message.ts,
      });

      logger.debug("Message stored", {
        channel: message.channel,
        user: message.user,
        ts: message.ts,
      });
    } catch (error) {
      logger.error("Error processing message", { error });
    }
  });

  logger.info("Message handler registered", {
    channels: env.SLACK_CHANNEL_IDS,
  });
}
