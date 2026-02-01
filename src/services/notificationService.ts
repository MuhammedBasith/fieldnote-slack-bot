import type { WebClient } from "@slack/web-api";
import type { DailyInsight, GeneratedPost } from "../db/schema.ts";
import { logger } from "../utils/logger.ts";

// Will be initialized from index.ts
let slackClient: WebClient;

export function initNotificationService(client: WebClient) {
  slackClient = client;
}

export interface InsightWithPosts {
  insight: DailyInsight;
  xPost: GeneratedPost;
  linkedInPost: GeneratedPost;
}

export const notificationService = {
  /**
   * Send the Fieldnote digest DM with cleaner format
   */
  async sendFieldnoteDigest(
    userId: string,
    insightsWithPosts: InsightWithPosts[]
  ): Promise<void> {
    if (!slackClient) {
      throw new Error("Notification service not initialized");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks: any[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Fieldnote",
          emoji: true,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Found *${insightsWithPosts.length}* insight${insightsWithPosts.length > 1 ? "s" : ""} from your conversations`,
          },
        ],
      },
      { type: "divider" },
    ];

    // Add each insight in compact format
    insightsWithPosts.forEach((item, index) => {
      const { insight, xPost, linkedInPost } = item;

      // Insight title and summary
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${index + 1}. ${insight.topic}*`,
        },
      });

      // Core insight as context
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: insight.core_insight,
          },
        ],
      });

      // Action buttons - compact with char count
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: `X (${xPost.char_count}c)`,
              emoji: false,
            },
            action_id: `view_x_${xPost.id}`,
            value: xPost.id,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "LinkedIn",
              emoji: false,
            },
            action_id: `view_linkedin_${linkedInPost.id}`,
            value: linkedInPost.id,
          },
        ],
      });

      // Only add divider between insights, not after the last one
      if (index < insightsWithPosts.length - 1) {
        blocks.push({ type: "divider" });
      }
    });

    // Footer
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Click to view full post, then copy and edit before publishing",
        },
      ],
    });

    try {
      await slackClient.chat.postMessage({
        channel: userId,
        text: `Fieldnote: Found ${insightsWithPosts.length} insights`,
        blocks,
      });

      logger.info("Fieldnote digest sent", {
        userId,
        insightCount: insightsWithPosts.length,
      });
    } catch (error) {
      logger.error("Failed to send Fieldnote digest", { error, userId });
      throw error;
    }
  },

  /**
   * Send "no new messages" notification
   */
  async sendNoNewMessages(userId: string): Promise<void> {
    if (!slackClient) {
      throw new Error("Notification service not initialized");
    }

    try {
      await slackClient.chat.postMessage({
        channel: userId,
        text: "No new conversations since your last Fieldnote. Check back after more discussions!",
      });
    } catch (error) {
      logger.error("Failed to send no messages notification", { error, userId });
      throw error;
    }
  },

  /**
   * Send "no insights found" notification
   */
  async sendNoInsights(userId: string, messageCount: number): Promise<void> {
    if (!slackClient) {
      throw new Error("Notification service not initialized");
    }

    try {
      await slackClient.chat.postMessage({
        channel: userId,
        text: `Analyzed ${messageCount} messages but didn't find any standout insights this time. Keep the conversations going!`,
      });
    } catch (error) {
      logger.error("Failed to send no insights notification", { error, userId });
      throw error;
    }
  },

  /**
   * Legacy: Send the daily digest DM (keeping for backward compatibility)
   */
  async sendDailyDigest(
    userId: string,
    insightsWithPosts: InsightWithPosts[]
  ): Promise<void> {
    // Use the new cleaner format
    return this.sendFieldnoteDigest(userId, insightsWithPosts);
  },

  /**
   * Send a simple message to a user
   */
  async sendMessage(userId: string, text: string): Promise<void> {
    if (!slackClient) {
      throw new Error("Notification service not initialized");
    }

    try {
      await slackClient.chat.postMessage({
        channel: userId,
        text,
      });
    } catch (error) {
      logger.error("Failed to send message", { error, userId });
      throw error;
    }
  },
};
