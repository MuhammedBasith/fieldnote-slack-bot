import { supabase } from "../db/client.ts";
import type { Message } from "../db/schema.ts";
import { logger } from "../utils/logger.ts";

export const messageService = {
  /**
   * Store a new message from Slack
   */
  async storeMessage(
    message: Omit<Message, "id" | "created_at">
  ): Promise<Message | null> {
    const { data, error } = await supabase
      .from("messages")
      .insert(message)
      .select()
      .single();

    if (error) {
      // Handle duplicate (already stored)
      if (error.code === "23505") {
        logger.debug("Message already exists", { slack_ts: message.slack_ts });
        return null;
      }
      logger.error("Failed to store message", { error });
      throw error;
    }

    return data;
  },

  /**
   * Get all messages from today for specified channels
   */
  async getTodayMessages(channelIds: string[]): Promise<Message[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .in("channel_id", channelIds)
      .gte("created_at", today.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Failed to fetch today's messages", { error });
      throw error;
    }

    return data || [];
  },

  /**
   * Get messages for a specific date range
   */
  async getMessagesForDateRange(
    channelIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<Message[]> {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .in("channel_id", channelIds)
      .gte("created_at", startDate.toISOString())
      .lt("created_at", endDate.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Failed to fetch messages for date range", { error });
      throw error;
    }

    return data || [];
  },
};
