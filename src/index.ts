import express from "express";
import { env } from "./config/env.ts";
import { slackApp, slackClient } from "./slack/app.ts";
import { setupPostActions } from "./slack/actions/postActions.ts";
import { setupFieldnoteCommand } from "./slack/commands/fieldnoteCommand.ts";
import { initNotificationService } from "./services/notificationService.ts";
import { initSlackHistoryService } from "./services/slackHistoryService.ts";
import { logger } from "./utils/logger.ts";

// Initialize Express for health checks and cron triggers
const expressApp = express();
expressApp.use(express.json());

// Initialize services with Slack client
initNotificationService(slackClient);
initSlackHistoryService(slackClient);

// Register Slack handlers
setupPostActions(slackApp);  // Button clicks in DMs
setupFieldnoteCommand(slackApp);  // /fieldnote slash command

// Start servers
async function start() {
  try {
    // Start Express server
    expressApp.listen(env.PORT, () => {
      logger.info(`Express server running on port ${env.PORT}`);
    });

    // Start Slack app (Socket Mode - needed for slash command and button interactions)
    await slackApp.start();
    logger.info("Slack Bolt app is running in Socket Mode");
    logger.info("Slash command /fieldnote is ready");
    logger.info(`Monitoring channels: ${env.SLACK_CHANNEL_IDS.join(", ")}`);
  } catch (error) {
    logger.error("Failed to start application", { error });
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await slackApp.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  await slackApp.stop();
  process.exit(0);
});

start();
