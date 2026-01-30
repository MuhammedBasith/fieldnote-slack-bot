import express from "express";
import { CronJob } from "cron";
import { env } from "./config/env.ts";
import { slackApp, slackClient } from "./slack/app.ts";
import { setupPostActions } from "./slack/actions/postActions.ts";
import { initNotificationService } from "./services/notificationService.ts";
import { initSlackHistoryService } from "./services/slackHistoryService.ts";
import { runDailyDigest } from "./jobs/dailyDigest.ts";
import { logger } from "./utils/logger.ts";

// Initialize Express for health checks and cron triggers
const expressApp = express();
expressApp.use(express.json());

// Health check endpoint
expressApp.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    timezone: env.DEFAULT_TIMEZONE,
    channels: env.SLACK_CHANNEL_IDS,
  });
});

// Cron trigger endpoint - called by external cron service (Render Cron, cron-job.org, etc.)
// Protected by a simple secret token
expressApp.post("/trigger-digest", async (req, res) => {
  // Check for authorization
  const authHeader = req.headers.authorization;
  const expectedToken = env.CRON_SECRET;

  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    logger.warn("Unauthorized digest trigger attempt");
    res.status(401).json({ status: "error", message: "Unauthorized" });
    return;
  }

  try {
    logger.info("Digest trigger requested");
    await runDailyDigest();
    res.json({ status: "ok", message: "Digest triggered successfully" });
  } catch (error) {
    logger.error("Digest trigger failed", { error });
    res.status(500).json({ status: "error", message: "Digest failed" });
  }
});

// Initialize services with Slack client
initNotificationService(slackClient);
initSlackHistoryService(slackClient);

// Register Slack action handlers (for button clicks in DMs)
setupPostActions(slackApp);

// Schedule daily digest job (backup - use external cron for Render free tier)
// On Render free tier, the service may sleep, so use Render Cron Jobs or external service
const cronExpression = `0 ${env.DAILY_DIGEST_HOUR} * * *`;
const dailyDigestJob = CronJob.from({
  cronTime: cronExpression,
  onTick: async () => {
    logger.info("Daily digest cron job triggered (in-process)");
    try {
      await runDailyDigest();
      logger.info("Daily digest cron job completed successfully");
    } catch (error) {
      logger.error("Daily digest cron job failed", { error });
    }
  },
  start: true,
  timeZone: env.DEFAULT_TIMEZONE,
});

// Start servers
async function start() {
  try {
    // Start Express server
    expressApp.listen(env.PORT, () => {
      logger.info(`Express server running on port ${env.PORT}`);
    });

    // Start Slack app (Socket Mode - needed for button interactions)
    await slackApp.start();
    logger.info("Slack Bolt app is running in Socket Mode");

    logger.info(
      `Daily digest scheduled for ${env.DAILY_DIGEST_HOUR}:00 ${env.DEFAULT_TIMEZONE}`
    );
    logger.info(`Will fetch messages from channels: ${env.SLACK_CHANNEL_IDS.join(", ")}`);
    logger.info(`Primary user for digest: ${env.SLACK_PRIMARY_USER_ID}`);
    logger.info("Note: Messages are fetched via API at digest time, not real-time");

    // Log next scheduled run
    const nextRun = dailyDigestJob.nextDate();
    logger.info(`Next digest scheduled for: ${nextRun.toISO()}`);
  } catch (error) {
    logger.error("Failed to start application", { error });
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  dailyDigestJob.stop();
  await slackApp.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  dailyDigestJob.stop();
  await slackApp.stop();
  process.exit(0);
});

start();
