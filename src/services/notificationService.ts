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
   * Send the daily digest DM with all insights and posts
   */
  async sendDailyDigest(
    userId: string,
    insightsWithPosts: InsightWithPosts[]
  ): Promise<void> {
    if (!slackClient) {
      throw new Error("Notification service not initialized");
    }

    // Using 'any' for blocks since Slack's Block Kit types are complex
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks: any[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Today's Content Signals",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Found *${insightsWithPosts.length}* moment${insightsWithPosts.length > 1 ? "s" : ""} worth sharing.`,
        },
      },
      { type: "divider" },
    ];

    // Add each insight with its posts
    insightsWithPosts.forEach((item, index) => {
      const { insight, xPost, linkedInPost } = item;

      // Insight header and context
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${index + 1}. ${insight.topic}*\n\n_Why this matters:_\n${insight.core_insight}`,
        },
      });

      // X Draft
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*X Draft* (${xPost.char_count} chars):\n\`\`\`${xPost.content}\`\`\``,
        },
      });

      // LinkedIn Draft (truncated for preview)
      const linkedInPreview =
        linkedInPost.content.length > 300
          ? linkedInPost.content.substring(0, 300) + "..."
          : linkedInPost.content;

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*LinkedIn Draft*:\n>${linkedInPreview.split("\n").join("\n>")}`,
        },
      });

      // Action buttons
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View X Post",
              emoji: true,
            },
            action_id: `view_x_${xPost.id}`,
            value: xPost.id,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View LinkedIn",
              emoji: true,
            },
            action_id: `view_linkedin_${linkedInPost.id}`,
            value: linkedInPost.id,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Ignore",
              emoji: true,
            },
            style: "danger",
            action_id: `ignore_insight_${insight.id}`,
            value: insight.id,
          },
        ],
      });

      blocks.push({ type: "divider" });
    });

    // Footer
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: '_Click "View" to copy the full post. Edit freely before publishing._',
        },
      ],
    });

    try {
      await slackClient.chat.postMessage({
        channel: userId, // DM to user
        text: `Today's Content Signals: Found ${insightsWithPosts.length} moments worth sharing.`,
        blocks,
      });

      logger.info("Daily digest DM sent", {
        userId,
        insightCount: insightsWithPosts.length,
      });
    } catch (error) {
      logger.error("Failed to send daily digest DM", { error, userId });
      throw error;
    }
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
