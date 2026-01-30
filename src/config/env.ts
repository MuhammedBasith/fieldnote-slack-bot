import { z } from "zod";

const envSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z
    .string()
    .default("3000")
    .transform(Number),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Slack
  SLACK_BOT_TOKEN: z.string().startsWith("xoxb-"),
  SLACK_APP_TOKEN: z.string().startsWith("xapp-"),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_CHANNEL_IDS: z
    .string()
    .transform((val) => val.split(",").map((id) => id.trim())),
  SLACK_PRIMARY_USER_ID: z.string().startsWith("U"),

  // OpenAI
  OPENAI_API_KEY: z.string().startsWith("sk-"),

  // App Config
  DEFAULT_TIMEZONE: z.string().default("America/Los_Angeles"),
  DAILY_DIGEST_HOUR: z
    .string()
    .default("18")
    .transform(Number),

  // Optional: Secret for external cron trigger (generate with: openssl rand -hex 32)
  CRON_SECRET: z.string().optional(),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Environment validation failed:");
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
