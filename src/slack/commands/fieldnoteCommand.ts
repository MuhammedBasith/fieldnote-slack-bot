import type { App } from "@slack/bolt";
import { runFieldnoteDigest } from "../../jobs/fieldnoteDigest.ts";
import { logger } from "../../utils/logger.ts";

/**
 * Register the /fieldnote slash command
 *
 * Commands:
 * - /fieldnote - Generate insights from recent conversations
 * - /fieldnote style - Learn your writing style from sample posts
 */
export function setupFieldnoteCommand(app: App): void {
  app.command("/fieldnote", async ({ ack, command, client }) => {
    // Must acknowledge within 3 seconds
    await ack();

    const userId = command.user_id;
    const channelId = command.channel_id;
    const subcommand = command.text?.trim().toLowerCase();

    logger.info("Fieldnote command received", { userId, channelId, subcommand });

    // Handle /fieldnote style - open modal to learn writing style
    if (subcommand === "style") {
      try {
        await client.views.open({
          trigger_id: command.trigger_id,
          view: {
            type: "modal",
            callback_id: "learn_style",
            title: {
              type: "plain_text",
              text: "Learn Your Style",
            },
            submit: {
              type: "plain_text",
              text: "Analyze",
            },
            close: {
              type: "plain_text",
              text: "Cancel",
            },
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "Paste your best LinkedIn or X posts below. This helps me match your unique writing style.",
                },
              },
              {
                type: "input",
                block_id: "post_1",
                label: {
                  type: "plain_text",
                  text: "Post 1",
                },
                element: {
                  type: "plain_text_input",
                  action_id: "post_input",
                  multiline: true,
                  min_length: 50,
                  placeholder: {
                    type: "plain_text",
                    text: "Paste your first post here...",
                  },
                },
              },
              {
                type: "input",
                block_id: "post_2",
                optional: true,
                label: {
                  type: "plain_text",
                  text: "Post 2 (optional)",
                },
                element: {
                  type: "plain_text_input",
                  action_id: "post_input",
                  multiline: true,
                  placeholder: {
                    type: "plain_text",
                    text: "Paste your second post here...",
                  },
                },
              },
              {
                type: "input",
                block_id: "post_3",
                optional: true,
                label: {
                  type: "plain_text",
                  text: "Post 3 (optional)",
                },
                element: {
                  type: "plain_text_input",
                  action_id: "post_input",
                  multiline: true,
                  placeholder: {
                    type: "plain_text",
                    text: "Paste your third post here...",
                  },
                },
              },
            ],
          },
        });

        logger.info("Style learning modal opened", { userId });
      } catch (error) {
        logger.error("Failed to open style modal", { error, userId });
      }
      return;
    }

    // Default: /fieldnote - run digest pipeline
    // Send immediate feedback
    try {
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: "Analyzing your conversations... You'll receive a DM shortly with any insights found.",
      });
    } catch (error) {
      logger.warn("Failed to send ephemeral message", { error });
      // Continue anyway - the DM will still be sent
    }

    // Run digest pipeline (don't await - let it run in background)
    // Results are sent via DM by the pipeline
    runFieldnoteDigest(userId).catch((error) => {
      logger.error("Fieldnote digest failed after command", { error, userId });
      // Try to notify user of failure
      client.chat.postMessage({
        channel: userId,
        text: "Something went wrong generating your insights. Please try again later.",
      }).catch(() => {
        // Ignore notification failure
      });
    });
  });

  logger.info("Fieldnote slash command registered");
}
