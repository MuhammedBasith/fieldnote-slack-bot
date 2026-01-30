import { supabase } from "../db/client.ts";
import type { DigestRun } from "../db/schema.ts";
import { logger } from "../utils/logger.ts";

export const digestRunService = {
  /**
   * Get the most recent digest run for a user
   */
  async getLastRun(slackUserId: string): Promise<DigestRun | null> {
    const { data, error } = await supabase
      .from("digest_runs")
      .select("*")
      .eq("slack_user_id", slackUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows found
        return null;
      }
      logger.error("Failed to get last digest run", { error, slackUserId });
      throw error;
    }

    return data;
  },

  /**
   * Create a new digest run record
   */
  async createRun(data: {
    slackUserId: string;
    newestMessageTs: string;
    messageCount: number;
    insightCount: number;
  }): Promise<DigestRun> {
    const { data: run, error } = await supabase
      .from("digest_runs")
      .insert({
        slack_user_id: data.slackUserId,
        newest_message_ts: data.newestMessageTs,
        message_count: data.messageCount,
        insight_count: data.insightCount,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create digest run", { error, data });
      throw error;
    }

    logger.info("Created digest run", {
      runId: run.id,
      slackUserId: data.slackUserId,
      messageCount: data.messageCount,
      insightCount: data.insightCount,
    });

    return run;
  },
};
