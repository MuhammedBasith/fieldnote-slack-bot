import type { App } from "@slack/bolt";
import { postService } from "../../services/postService.ts";
import { insightService } from "../../services/insightService.ts";
import { logger } from "../../utils/logger.ts";

/**
 * Set up button action handlers for post interactions
 */
export function setupPostActions(app: App) {
  // Handle "View X Post" button
  app.action(/^view_x_/, async ({ ack, body, client, action }) => {
    await ack();

    const postId = (action as { value: string }).value;

    try {
      const post = await postService.getPostById(postId);

      if (!post) {
        logger.warn("Post not found for view_x action", { postId });
        return;
      }

      // Update status to viewed
      await postService.updatePostStatus(postId, "viewed");

      // Open modal with full post for copying
      await client.views.open({
        trigger_id: (body as { trigger_id: string }).trigger_id,
        view: {
          type: "modal",
          title: {
            type: "plain_text",
            text: "X Post",
          },
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Character count:* ${post.char_count}/280`,
              },
            },
            {
              type: "divider",
            },
            {
              type: "section",
              text: {
                type: "plain_text",
                text: post.content,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: "_Copy this text and paste it into X. Edit freely before posting!_",
                },
              ],
            },
          ],
        },
      });

      logger.info("X post viewed", { postId });
    } catch (error) {
      logger.error("Error handling view_x action", { error, postId });
    }
  });

  // Handle "View LinkedIn" button
  app.action(/^view_linkedin_/, async ({ ack, body, client, action }) => {
    await ack();

    const postId = (action as { value: string }).value;

    try {
      const post = await postService.getPostById(postId);

      if (!post) {
        logger.warn("Post not found for view_linkedin action", { postId });
        return;
      }

      // Update status to viewed
      await postService.updatePostStatus(postId, "viewed");

      // Calculate word count
      const wordCount = post.content.split(/\s+/).length;

      // Open modal with full post for copying
      await client.views.open({
        trigger_id: (body as { trigger_id: string }).trigger_id,
        view: {
          type: "modal",
          title: {
            type: "plain_text",
            text: "LinkedIn Post",
          },
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Word count:* ~${wordCount} words`,
              },
            },
            {
              type: "divider",
            },
            {
              type: "section",
              text: {
                type: "plain_text",
                text: post.content,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: "_Copy this text and paste it into LinkedIn. Edit freely before posting!_",
                },
              ],
            },
          ],
        },
      });

      logger.info("LinkedIn post viewed", { postId });
    } catch (error) {
      logger.error("Error handling view_linkedin action", { error, postId });
    }
  });

  // Handle "Ignore" button
  app.action(/^ignore_insight_/, async ({ ack, action, respond }) => {
    await ack();

    const insightId = (action as { value: string }).value;

    try {
      await insightService.updateStatus(insightId, "ignored");

      // Send ephemeral confirmation
      await respond({
        text: "Got it! This insight has been ignored.",
        replace_original: false,
        response_type: "ephemeral",
      });

      logger.info("Insight ignored", { insightId });
    } catch (error) {
      logger.error("Error handling ignore action", { error, insightId });

      await respond({
        text: "Something went wrong. Please try again.",
        replace_original: false,
        response_type: "ephemeral",
      });
    }
  });

  logger.info("Post action handlers registered");
}
