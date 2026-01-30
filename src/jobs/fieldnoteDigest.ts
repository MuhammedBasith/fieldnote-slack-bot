import { env } from "../config/env.ts";
import {
  slackHistoryService,
  type MessageWithUser,
} from "../services/slackHistoryService.ts";
import { insightService } from "../services/insightService.ts";
import { postService } from "../services/postService.ts";
import { profileService } from "../services/profileService.ts";
import { digestRunService } from "../services/digestRunService.ts";
import { notificationService } from "../services/notificationService.ts";
import { logger } from "../utils/logger.ts";

export interface FieldnoteResult {
  success: boolean;
  messageCount: number;
  insightCount: number;
  error?: string;
}

/**
 * Run the Fieldnote digest pipeline for a specific user
 * Called when user triggers /fieldnote slash command
 *
 * Smart time window: Fetches only messages since last run
 * Single LLM call: Generates both X and LinkedIn posts together
 */
export async function runFieldnoteDigest(
  slackUserId: string
): Promise<FieldnoteResult> {
  logger.info("Starting Fieldnote digest", { slackUserId });

  try {
    // Step 1: Get last digest run for smart time window
    const lastRun = await digestRunService.getLastRun(slackUserId);
    const oldestTs = lastRun?.newest_message_ts;

    if (lastRun) {
      logger.info("Found previous digest run", {
        lastRunAt: lastRun.created_at,
        oldestTs,
      });
    } else {
      logger.info("First digest run for user, fetching last 24h");
    }

    // Step 2: Fetch messages since last run (or last 24h)
    const messages = await slackHistoryService.getMessagesSince(
      env.SLACK_CHANNEL_IDS,
      oldestTs
    );

    if (messages.length === 0) {
      logger.info("No new messages since last run");
      await notificationService.sendNoNewMessages(slackUserId);
      return { success: true, messageCount: 0, insightCount: 0 };
    }

    logger.info(`Found ${messages.length} new messages to analyze`);

    // Step 3: Format conversation for LLM
    const conversationText = formatConversation(messages);

    // Step 4: Extract insights (1 LLM call)
    const insights = await insightService.extractInsights(conversationText);

    if (insights.length === 0) {
      logger.info("No meaningful insights extracted");
      await notificationService.sendNoInsights(slackUserId, messages.length);
      // Still record the run so we don't re-process these messages
      await recordRun(slackUserId, messages, 0);
      return { success: true, messageCount: messages.length, insightCount: 0 };
    }

    logger.info(`Extracted ${insights.length} insights`);

    // Step 5: Get or create user profile
    const userProfile = await profileService.getOrCreateProfile(slackUserId);

    // Step 6: Generate posts for each insight (1 LLM call per insight, not 2)
    const insightsWithPosts = [];

    for (const insight of insights) {
      try {
        // Store the insight
        const storedInsight = await insightService.storeInsight({
          user_id: userProfile.id,
          insight_date: new Date().toISOString().split("T")[0]!,
          topic: insight.topic,
          core_insight: insight.core_insight,
          supporting_context: insight.supporting_context,
          status: "pending",
        });

        // Generate BOTH posts in single LLM call
        const { xPost: xPostContent, linkedInPost: linkedInPostContent } =
          await postService.generateBothPosts(insight, userProfile);

        // Store generated posts
        const storedXPost = await postService.storePost({
          insight_id: storedInsight.id,
          platform: "x",
          content: xPostContent,
          char_count: xPostContent.length,
          status: "draft",
        });

        const storedLinkedInPost = await postService.storePost({
          insight_id: storedInsight.id,
          platform: "linkedin",
          content: linkedInPostContent,
          char_count: linkedInPostContent.length,
          status: "draft",
        });

        // Update insight status
        await insightService.updateStatus(storedInsight.id, "posts_generated");

        insightsWithPosts.push({
          insight: storedInsight,
          xPost: storedXPost,
          linkedInPost: storedLinkedInPost,
        });

        logger.info(`Generated posts for insight: ${insight.topic}`);
      } catch (error) {
        logger.error(`Failed to process insight: ${insight.topic}`, { error });
        // Continue with other insights
      }
    }

    if (insightsWithPosts.length === 0) {
      logger.warn("No posts generated despite having insights");
      await recordRun(slackUserId, messages, 0);
      return {
        success: false,
        messageCount: messages.length,
        insightCount: 0,
        error: "Failed to generate posts",
      };
    }

    // Step 7: Send clean Slack DM with all insights and posts
    await notificationService.sendFieldnoteDigest(slackUserId, insightsWithPosts);

    // Update all insights to sent status
    for (const item of insightsWithPosts) {
      await insightService.updateStatus(item.insight.id, "sent");
    }

    // Step 8: Record this run for smart time window
    await recordRun(slackUserId, messages, insightsWithPosts.length);

    logger.info("Fieldnote digest completed successfully", {
      slackUserId,
      messageCount: messages.length,
      insightCount: insightsWithPosts.length,
    });

    return {
      success: true,
      messageCount: messages.length,
      insightCount: insightsWithPosts.length,
    };
  } catch (error) {
    logger.error("Fieldnote digest failed", { error, slackUserId });
    return {
      success: false,
      messageCount: 0,
      insightCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Format messages into conversation text for LLM
 */
function formatConversation(messages: MessageWithUser[]): string {
  return messages
    .map((m) => `[${m.user_name || m.user_id}]: ${m.text}`)
    .join("\n");
}

/**
 * Record a digest run for smart time window tracking
 */
async function recordRun(
  slackUserId: string,
  messages: MessageWithUser[],
  insightCount: number
): Promise<void> {
  if (messages.length === 0) return;

  // Get the newest message timestamp (messages are sorted oldest first)
  const newestTs = messages[messages.length - 1]!.ts;

  await digestRunService.createRun({
    slackUserId,
    newestMessageTs: newestTs,
    messageCount: messages.length,
    insightCount,
  });
}
