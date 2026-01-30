import type { App } from "@slack/bolt";
import { runFieldnoteDigest } from "../../jobs/fieldnoteDigest.ts";
import { logger } from "../../utils/logger.ts";

/**
 * Register the /fieldnote slash command
 *
 * When user types /fieldnote:
 * 1. Acknowledge immediately (Slack requires response within 3 seconds)
 * 2. Send "working" ephemeral message
 * 3. Run the digest pipeline in background
 * 4. Results are sent via DM by the pipeline
 */
export function setupFieldnoteCommand(app: App): void {
  app.command("/fieldnote", async ({ ack, command, client }) => {
    // Must acknowledge within 3 seconds
    await ack();

    const userId = command.user_id;
    const channelId = command.channel_id;

    logger.info("Fieldnote command received", { userId, channelId });

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
