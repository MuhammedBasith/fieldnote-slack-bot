import { supabase } from "../db/client.ts";
import type { GeneratedPost, UserProfile } from "../db/schema.ts";
import { llmClient } from "../llm/client.ts";
import {
  COMBINED_POST_PROMPT,
  type ExtractedInsight,
  type CombinedPostResponse,
} from "../llm/prompts.ts";
import { logger } from "../utils/logger.ts";

/**
 * Smart truncate at word boundary with ellipsis
 */
function smartTruncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  // Reserve space for ellipsis
  const truncateAt = maxLength - 3;

  // Find last space before truncateAt
  let lastSpace = text.lastIndexOf(" ", truncateAt);

  // If no space found or too short, just cut at truncateAt
  if (lastSpace < truncateAt * 0.7) {
    lastSpace = truncateAt;
  }

  return text.substring(0, lastSpace).trim() + "...";
}

export const postService = {
  /**
   * Generate both X and LinkedIn posts in a single LLM call
   */
  async generateBothPosts(
    insight: ExtractedInsight,
    profile: UserProfile
  ): Promise<{ xPost: string; linkedInPost: string }> {
    const systemPrompt = COMBINED_POST_PROMPT.system({
      writing_tone: profile.writing_tone,
      stylistic_rules: profile.stylistic_rules,
      banned_phrases: profile.banned_phrases,
    });

    const userPrompt = COMBINED_POST_PROMPT.user(insight);

    // Combined response needs ~800 tokens (150 for X + 600 for LinkedIn + JSON structure)
    const response = await llmClient.generateJSON<CombinedPostResponse>(
      systemPrompt,
      userPrompt,
      { maxTokens: 800 }
    );

    let xPost = response.x_post;

    // Smart truncation for X post if still over 280
    if (xPost.length > 280) {
      logger.warn("X post exceeded 280 chars, truncating", {
        original: xPost.length,
      });
      xPost = smartTruncate(xPost, 280);
    }

    return {
      xPost,
      linkedInPost: response.linkedin_post,
    };
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
