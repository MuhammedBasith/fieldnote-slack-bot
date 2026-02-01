import type { App } from "@slack/bolt";
import { postService } from "../../services/postService.ts";
import { profileService } from "../../services/profileService.ts";
import { llmClient } from "../../llm/client.ts";
import {
  STYLE_EXTRACTION_PROMPT,
  type StyleExtractionResponse,
} from "../../llm/prompts.ts";
import { logger } from "../../utils/logger.ts";

/**
 * Set up button action handlers for post interactions
 */
export function setupPostActions(app: App) {
  // Handle "View X Post" button - opens read-only modal with Copy/Edit options
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

      // Open modal in VIEW mode (read-only with Copy button)
      await client.views.open({
        trigger_id: (body as { trigger_id: string }).trigger_id,
        view: {
          type: "modal",
          callback_id: "view_x_modal",
          private_metadata: postId,
          title: {
            type: "plain_text",
            text: "X Post",
          },
          close: {
            type: "plain_text",
            text: "Close",
          },
          blocks: [
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `*${post.char_count}/280 characters*`,
                },
              ],
            },
            {
              type: "divider",
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: post.content,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: " ",
              },
              accessory: {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Edit",
                  emoji: false,
                },
                action_id: `edit_x_${postId}`,
                value: postId,
              },
            },
          ],
        },
      });

      logger.info("X post view modal opened", { postId });
    } catch (error) {
      logger.error("Error handling view_x action", { error, postId });
    }
  });

  // Handle "Edit X" button - switches to editable modal
  app.action(/^edit_x_/, async ({ ack, body, client, action }) => {
    await ack();

    const postId = (action as { value: string }).value;

    try {
      const post = await postService.getPostById(postId);

      if (!post) {
        logger.warn("Post not found for edit_x action", { postId });
        return;
      }

      // Update modal to EDIT mode
      await client.views.update({
        view_id: (body as { view: { id: string } }).view.id,
        view: {
          type: "modal",
          callback_id: "save_x_post",
          private_metadata: postId,
          title: {
            type: "plain_text",
            text: "Edit X Post",
          },
          submit: {
            type: "plain_text",
            text: "Save",
          },
          close: {
            type: "plain_text",
            text: "Cancel",
          },
          blocks: [
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `*${post.char_count}/280 characters* • Edit below`,
                },
              ],
            },
            {
              type: "divider",
            },
            {
              type: "input",
              block_id: "post_content",
              label: {
                type: "plain_text",
                text: "Post content",
              },
              element: {
                type: "plain_text_input",
                action_id: "post_text",
                multiline: true,
                initial_value: post.content,
              },
            },
          ],
        },
      });

      logger.info("X post edit modal opened", { postId });
    } catch (error) {
      logger.error("Error handling edit_x action", { error, postId });
    }
  });

  // Handle X post save submission
  app.view("save_x_post", async ({ ack, view, body, client }) => {
    const postId = view.private_metadata;
    const newContent = view.state.values.post_content?.post_text?.value || "";

    // Validate character count for X
    if (newContent.length > 280) {
      await ack({
        response_action: "errors",
        errors: {
          post_content: `Post is ${newContent.length} characters. X limit is 280.`,
        },
      });
      return;
    }

    await ack();

    try {
      await postService.updatePostContent(postId, newContent);

      await client.chat.postMessage({
        channel: body.user.id,
        text: `X post saved! (${newContent.length}/280 chars)`,
      });

      logger.info("X post updated", { postId, charCount: newContent.length });
    } catch (error) {
      logger.error("Error saving X post", { error, postId });
    }
  });

  // Handle "View LinkedIn" button - opens read-only modal with Copy/Edit options
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

      const wordCount = post.content.split(/\s+/).length;

      // Open modal in VIEW mode (read-only with Copy button)
      await client.views.open({
        trigger_id: (body as { trigger_id: string }).trigger_id,
        view: {
          type: "modal",
          callback_id: "view_linkedin_modal",
          private_metadata: postId,
          title: {
            type: "plain_text",
            text: "LinkedIn Post",
          },
          close: {
            type: "plain_text",
            text: "Close",
          },
          blocks: [
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `*~${wordCount} words*`,
                },
              ],
            },
            {
              type: "divider",
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: post.content,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: " ",
              },
              accessory: {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Edit",
                  emoji: false,
                },
                action_id: `edit_linkedin_${postId}`,
                value: postId,
              },
            },
          ],
        },
      });

      logger.info("LinkedIn post view modal opened", { postId });
    } catch (error) {
      logger.error("Error handling view_linkedin action", { error, postId });
    }
  });

  // Handle "Edit LinkedIn" button - switches to editable modal
  app.action(/^edit_linkedin_/, async ({ ack, body, client, action }) => {
    await ack();

    const postId = (action as { value: string }).value;

    try {
      const post = await postService.getPostById(postId);

      if (!post) {
        logger.warn("Post not found for edit_linkedin action", { postId });
        return;
      }

      const wordCount = post.content.split(/\s+/).length;

      // Update modal to EDIT mode
      await client.views.update({
        view_id: (body as { view: { id: string } }).view.id,
        view: {
          type: "modal",
          callback_id: "save_linkedin_post",
          private_metadata: postId,
          title: {
            type: "plain_text",
            text: "Edit LinkedIn Post",
          },
          submit: {
            type: "plain_text",
            text: "Save",
          },
          close: {
            type: "plain_text",
            text: "Cancel",
          },
          blocks: [
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `*~${wordCount} words* • Edit below`,
                },
              ],
            },
            {
              type: "divider",
            },
            {
              type: "input",
              block_id: "post_content",
              label: {
                type: "plain_text",
                text: "Post content",
              },
              element: {
                type: "plain_text_input",
                action_id: "post_text",
                multiline: true,
                initial_value: post.content,
              },
            },
          ],
        },
      });

      logger.info("LinkedIn post edit modal opened", { postId });
    } catch (error) {
      logger.error("Error handling edit_linkedin action", { error, postId });
    }
  });

  // Handle LinkedIn post save submission
  app.view("save_linkedin_post", async ({ ack, view, body, client }) => {
    await ack();

    const postId = view.private_metadata;
    const newContent = view.state.values.post_content?.post_text?.value || "";

    try {
      await postService.updatePostContent(postId, newContent);

      const wordCount = newContent.split(/\s+/).length;

      await client.chat.postMessage({
        channel: body.user.id,
        text: `LinkedIn post saved! (~${wordCount} words)`,
      });

      logger.info("LinkedIn post updated", { postId, wordCount });
    } catch (error) {
      logger.error("Error saving LinkedIn post", { error, postId });
    }
  });

  // Handle style learning modal submission
  app.view("learn_style", async ({ ack, view, body, client }) => {
    await ack();

    const userId = body.user.id;

    // Collect posts from 3 separate input fields
    const post1 = view.state.values.post_1?.post_input?.value || "";
    const post2 = view.state.values.post_2?.post_input?.value || "";
    const post3 = view.state.values.post_3?.post_input?.value || "";

    // Combine non-empty posts
    const samplePosts = [post1, post2, post3]
      .filter((p) => p.trim().length > 0)
      .join("\n\n---\n\n");

    try {
      // Extract style using LLM
      const style = await llmClient.generateJSON<StyleExtractionResponse>(
        STYLE_EXTRACTION_PROMPT.system,
        STYLE_EXTRACTION_PROMPT.user(samplePosts),
        { maxTokens: 500 }
      );

      // Ensure profile exists, then update it
      await profileService.getOrCreateProfile(userId);
      await profileService.updateProfile(userId, {
        writing_tone: style.writing_tone,
        stylistic_rules: style.stylistic_rules,
      });

      // Confirm to user
      const rulesText = style.stylistic_rules
        .map((r) => `• ${r}`)
        .join("\n");

      await client.chat.postMessage({
        channel: userId,
        text: `Style learned!\n\n*Tone:* ${style.writing_tone}\n\n*Rules:*\n${rulesText}\n\n_${style.observations}_\n\nYour future posts will follow this style.`,
      });

      logger.info("Style learned for user", {
        userId,
        tone: style.writing_tone,
        ruleCount: style.stylistic_rules.length,
      });
    } catch (error) {
      logger.error("Error learning style", { error, userId });

      await client.chat.postMessage({
        channel: userId,
        text: "Something went wrong analyzing your style. Please try again with different samples.",
      });
    }
  });

  logger.info("Post action handlers registered");
}
