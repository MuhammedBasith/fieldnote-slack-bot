import { supabase } from "../db/client.ts";
import type { GeneratedPost, UserProfile } from "../db/schema.ts";
import { llmClient } from "../llm/client.ts";
import {
  POST_GENERATION_PROMPT,
  type ExtractedInsight,
} from "../llm/prompts.ts";
import { logger } from "../utils/logger.ts";

export const postService = {
  /**
   * Generate a post for a specific platform
   */
  async generatePost(
    insight: ExtractedInsight,
    profile: UserProfile,
    platform: "x" | "linkedin"
  ): Promise<string> {
    const systemPrompt = POST_GENERATION_PROMPT.system({
      writing_tone: profile.writing_tone,
      stylistic_rules: profile.stylistic_rules,
      banned_phrases: profile.banned_phrases,
    });

    const userPrompt =
      platform === "x"
        ? POST_GENERATION_PROMPT.xPost(insight)
        : POST_GENERATION_PROMPT.linkedInPost(insight);

    // Token limits: X posts need ~150 tokens (280 chars), LinkedIn ~600 tokens (300 words)
    const maxTokens = platform === "x" ? 150 : 600;
    let content = await llmClient.generateContent(systemPrompt, userPrompt, { maxTokens });

    // For X, ensure under 280 chars
    if (platform === "x" && content.length > 280) {
      logger.warn("X post exceeded 280 chars, requesting shorter version", {
        length: content.length,
      });

      content = await llmClient.generateContent(
        systemPrompt,
        `${userPrompt}\n\nIMPORTANT: Your previous response was ${content.length} characters. It MUST be under 280. Be more concise.`,
        { maxTokens: 150 }
      );

      // Hard truncate as last resort
      if (content.length > 280) {
        content = content.substring(0, 277) + "...";
        logger.warn("X post truncated to 280 chars");
      }
    }

    return content;
  },

  /**
   * Store a generated post in the database
   */
  async storePost(
    post: Omit<GeneratedPost, "id" | "created_at">
  ): Promise<GeneratedPost> {
    const { data, error } = await supabase
      .from("generated_posts")
      .insert(post)
      .select()
      .single();

    if (error) {
      logger.error("Failed to store post", { error });
      throw error;
    }

    return data;
  },

  /**
   * Update post status
   */
  async updatePostStatus(
    postId: string,
    status: GeneratedPost["status"]
  ): Promise<void> {
    const { error } = await supabase
      .from("generated_posts")
      .update({ status })
      .eq("id", postId);

    if (error) {
      logger.error("Failed to update post status", { error, postId });
      throw error;
    }
  },

  /**
   * Get post by ID
   */
  async getPostById(postId: string): Promise<GeneratedPost | null> {
    const { data, error } = await supabase
      .from("generated_posts")
      .select("*")
      .eq("id", postId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error("Failed to get post", { error, postId });
      throw error;
    }

    return data;
  },

  /**
   * Get posts by insight ID
   */
  async getPostsByInsightId(insightId: string): Promise<GeneratedPost[]> {
    const { data, error } = await supabase
      .from("generated_posts")
      .select("*")
      .eq("insight_id", insightId);

    if (error) {
      logger.error("Failed to get posts for insight", { error, insightId });
      throw error;
    }

    return data || [];
  },
};
