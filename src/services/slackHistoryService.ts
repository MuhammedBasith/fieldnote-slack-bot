import type { WebClient } from "@slack/web-api";
import { logger } from "../utils/logger.ts";

// Will be initialized from index.ts
let slackClient: WebClient;

export function initSlackHistoryService(client: WebClient) {
  slackClient = client;
}

interface SlackMessage {
  user?: string;
  text?: string;
  ts: string;
  bot_id?: string;
  subtype?: string;
}

interface MessageWithUser {
  user_id: string;
  user_name: string | null;
  text: string;
  ts: string;
}

/**
 * Fetch messages from a channel for today using Slack's conversations.history API
 * This is more reliable than real-time listening for free tier hosting
 */
export const slackHistoryService = {
  /**
   * Get today's messages from a channel
   */
  async getTodayMessages(channelId: string): Promise<MessageWithUser[]> {
    if (!slackClient) {
      throw new Error("Slack history service not initialized");
    }

    // Calculate start of today (midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oldestTs = (today.getTime() / 1000).toString();

    const messages: MessageWithUser[] = [];
    let cursor: string | undefined;

    try {
      // Paginate through all messages
      do {
        const response = await slackClient.conversations.history({
          channel: channelId,
          oldest: oldestTs,
          limit: 200,
          cursor,
        });

        if (response.messages) {
          for (const msg of response.messages as SlackMessage[]) {
            // Skip bot messages and subtypes (joins, leaves, etc.)
            if (msg.bot_id || msg.subtype || !msg.text) {
              continue;
            }

            // Get user info
            let userName: string | null = null;
            if (msg.user) {
              try {
                const userInfo = await slackClient.users.info({ user: msg.user });
                userName = userInfo.user?.real_name || userInfo.user?.name || null;
              } catch {
                logger.warn("Could not fetch user info", { userId: msg.user });
              }
            }

            messages.push({
              user_id: msg.user || "unknown",
              user_name: userName,
              text: msg.text,
              ts: msg.ts,
            });
          }
        }

        cursor = response.response_metadata?.next_cursor;
      } while (cursor);

      // Sort by timestamp (oldest first)
      messages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

      logger.info(`Fetched ${messages.length} messages from channel ${channelId}`);
      return messages;
    } catch (error) {
      logger.error("Failed to fetch channel history", { error, channelId });
      throw error;
    }
  },

  /**
   * Get today's messages from multiple channels
   */
  async getTodayMessagesFromChannels(channelIds: string[]): Promise<MessageWithUser[]> {
    const allMessages: MessageWithUser[] = [];

    for (const channelId of channelIds) {
      const channelMessages = await this.getTodayMessages(channelId);
      allMessages.push(...channelMessages);
    }

    // Sort all messages by timestamp
    allMessages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

    return allMessages;
  },

  /**
   * Get messages since a specific timestamp (for smart time window)
   * Falls back to last 24 hours if no timestamp provided
   */
  async getMessagesSince(
    channelIds: string[],
    oldestTs?: string,
    maxHoursBack: number = 24
  ): Promise<MessageWithUser[]> {
    if (!slackClient) {
      throw new Error("Slack history service not initialized");
    }

    // Calculate fallback timestamp (maxHoursBack ago)
    const fallbackTime = new Date();
    fallbackTime.setHours(fallbackTime.getHours() - maxHoursBack);
    const fallbackTs = (fallbackTime.getTime() / 1000).toString();

    // Use provided timestamp or fallback, but never go further than maxHoursBack
    let effectiveOldestTs = oldestTs || fallbackTs;

    // Ensure we don't go further back than maxHoursBack
    if (parseFloat(effectiveOldestTs) < parseFloat(fallbackTs)) {
      effectiveOldestTs = fallbackTs;
      logger.info("Capping oldest timestamp to max hours back", { maxHoursBack });
    }

    const allMessages: MessageWithUser[] = [];

    for (const channelId of channelIds) {
      let cursor: string | undefined;

      try {
        do {
          const response = await slackClient.conversations.history({
            channel: channelId,
            oldest: effectiveOldestTs,
            limit: 200,
            cursor,
          });

          if (response.messages) {
            for (const msg of response.messages as SlackMessage[]) {
              // Skip bot messages and subtypes
              if (msg.bot_id || msg.subtype || !msg.text) {
                continue;
              }

              // Get user info
              let userName: string | null = null;
              if (msg.user) {
                try {
                  const userInfo = await slackClient.users.info({ user: msg.user });
                  userName = userInfo.user?.real_name || userInfo.user?.name || null;
                } catch {
                  logger.warn("Could not fetch user info", { userId: msg.user });
                }
              }

              allMessages.push({
                user_id: msg.user || "unknown",
                user_name: userName,
                text: msg.text,
                ts: msg.ts,
              });
            }
          }

          cursor = response.response_metadata?.next_cursor;
        } while (cursor);
      } catch (error) {
        logger.error("Failed to fetch channel history", { error, channelId });
        throw error;
      }
    }

    // Sort by timestamp (oldest first)
    allMessages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

    logger.info(`Fetched ${allMessages.length} messages since ${effectiveOldestTs}`, {
      channelCount: channelIds.length,
      oldestProvided: !!oldestTs,
    });

    return allMessages;
  },
};

export type { MessageWithUser };
