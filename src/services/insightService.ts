import { supabase } from "../db/client.ts";
import type { DailyInsight } from "../db/schema.ts";
import { llmClient } from "../llm/client.ts";
import {
  INSIGHT_EXTRACTION_PROMPT,
  type ExtractedInsight,
} from "../llm/prompts.ts";
import { logger } from "../utils/logger.ts";

export const insightService = {
  /**
   * Extract insights from a conversation using LLM
   */
  async extractInsights(conversationText: string): Promise<ExtractedInsight[]> {
    try {
      // 3 insights with JSON structure needs ~500 tokens to be safe
      const insights = await llmClient.generateJSON<ExtractedInsight[]>(
        INSIGHT_EXTRACTION_PROMPT.system,
        INSIGHT_EXTRACTION_PROMPT.user(conversationText),
        { maxTokens: 600 }
      );

      // Validate response
      if (!Array.isArray(insights)) {
        logger.warn("LLM returned non-array for insights");
        return [];
      }

      // Filter valid insights and limit to 3
      return insights
        .filter((i) => i.topic && i.core_insight)
        .slice(0, 3);
    } catch (error) {
      logger.error("Failed to extract insights", { error });
      return [];
    }
  },

  /**
   * Store an insight in the database
   */
  async storeInsight(
    insight: Omit<DailyInsight, "id" | "created_at">
  ): Promise<DailyInsight> {
    const { data, error } = await supabase
      .from("daily_insights")
      .insert(insight)
      .select()
      .single();

    if (error) {
      logger.error("Failed to store insight", { error });
      throw error;
    }

    return data;
  },

  /**
   * Update insight status
   */
  async updateStatus(
    insightId: string,
    status: DailyInsight["status"]
  ): Promise<void> {
    const { error } = await supabase
      .from("daily_insights")
      .update({ status })
      .eq("id", insightId);

    if (error) {
      logger.error("Failed to update insight status", { error, insightId });
      throw error;
    }
  },

  /**
   * Get insight by ID
   */
  async getInsightById(insightId: string): Promise<DailyInsight | null> {
    const { data, error } = await supabase
      .from("daily_insights")
      .select("*")
      .eq("id", insightId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error("Failed to get insight", { error, insightId });
      throw error;
    }

    return data;
  },
};
