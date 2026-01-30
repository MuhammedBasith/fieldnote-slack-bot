import { App, LogLevel } from "@slack/bolt";
import { env } from "../config/env.ts";

// Initialize Slack Bolt app with Socket Mode
// Socket Mode allows receiving events without a public URL
export const slackApp = new App({
  token: env.SLACK_BOT_TOKEN,
  appToken: env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: env.NODE_ENV === "development" ? LogLevel.DEBUG : LogLevel.INFO,
});

// Export the web client for sending messages
export const slackClient = slackApp.client;
