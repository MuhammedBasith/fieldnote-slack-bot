import { env } from "../config/env.ts";
import { slackHistoryService } from "../services/slackHistoryService.ts";
import { insightService } from "../services/insightService.ts";
import { postService } from "../services/postService.ts";
import { profileService } from "../services/profileService.ts";
import {
  notificationService,
  type InsightWithPosts,
} from "../services/notificationService.ts";
import { logger } from "../utils/logger.ts";

/**
 * Run the daily digest pipeline
 * 1. Fetch today's messages directly from Slack API (no real-time listener needed)
 * 2. Extract insights using LLM
 * 3. Generate posts for each insight
 * 4. Send Slack DM with digest
 */
export async function runDailyDigest(): Promise<void> {
  logger.info("Starting daily digest pipeline");

  try {
    // Step 1: Fetch today's messages directly from Slack API
    // This approach works reliably even on free tier hosting that sleeps
    const messages = await slackHistoryService.getTodayMessagesFromChannels(
      env.SLACK_CHANNEL_IDS
    );

    if (messages.length === 0) {
      logger.info("No messages found for today, skipping digest");
      return;
    }

    logger.info(`Found ${messages.length} messages to analyze`);

    // Step 2: Format conversation for LLM
    const conversationText = messages
      .map((m) => `[${m.user_name || m.user_id}]: ${m.text}`)
      .join("\n");

    // Step 3: Extract insights using LLM
    const insights = await insightService.extractInsights(conversationText);

    if (insights.length === 0) {
      logger.info("No meaningful insights extracted, skipping digest");
      return;
    }

    logger.info(`Extracted ${insights.length} insights`);

    // Step 4: Get user profile for personalization
    const userProfile = await profileService.getOrCreateProfile(
      env.SLACK_PRIMARY_USER_ID
    );

    // Step 5: Generate posts for each insight
    const insightsWithPosts: InsightWithPosts[] = [];

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

        // Generate X post
        const xPostContent = await postService.generatePost(
          insight,
          userProfile,
          "x"
        );

        // Generate LinkedIn post
        const linkedInPostContent = await postService.generatePost(
          insight,
          userProfile,
          "linkedin"
        );

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
      logger.warn("No posts generated, skipping DM");
      return;
    }

    // Step 6: Send Slack DM with all insights and posts
    await notificationService.sendDailyDigest(
      env.SLACK_PRIMARY_USER_ID,
      insightsWithPosts
    );

    // Update all insights to sent status
    for (const item of insightsWithPosts) {
      await insightService.updateStatus(item.insight.id, "sent");
    }

    logger.info("Daily digest pipeline completed successfully", {
      insightCount: insightsWithPosts.length,
    });
  } catch (error) {
    logger.error("Daily digest pipeline failed", { error });
    throw error;
  }
}

// Allow running directly for testing
if (import.meta.main) {
  runDailyDigest()
    .then(() => {
      console.log("Daily digest completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Daily digest failed:", error);
      process.exit(1);
    });
}
