import { supabase } from "../db/client.ts";
import type { UserProfile } from "../db/schema.ts";
import { logger } from "../utils/logger.ts";

export const profileService = {
  /**
   * Get user profile by Slack user ID, or create a default one
   */
  async getOrCreateProfile(slackUserId: string): Promise<UserProfile> {
    // Try to get existing profile
    const { data: existing, error: fetchError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("slack_user_id", slackUserId)
      .single();

    if (existing) {
      return existing;
    }

    // If not found, create a new profile
    if (fetchError && fetchError.code === "PGRST116") {
      const { data: newProfile, error: insertError } = await supabase
        .from("user_profiles")
        .insert({
          slack_user_id: slackUserId,
          writing_tone: null,
          stylistic_rules: [],
          banned_phrases: [],
          interests: [],
          timezone: "America/Los_Angeles",
        })
        .select()
        .single();

      if (insertError) {
        logger.error("Failed to create user profile", { error: insertError });
        throw insertError;
      }

      logger.info("Created new user profile", { slackUserId });
      return newProfile;
    }

    if (fetchError) {
      logger.error("Failed to fetch user profile", { error: fetchError });
      throw fetchError;
    }

    // This shouldn't happen, but TypeScript needs it
    throw new Error("Unexpected error fetching user profile");
  },

  /**
   * Update user profile
   */
  async updateProfile(
    slackUserId: string,
    updates: Partial<Omit<UserProfile, "id" | "slack_user_id" | "created_at">>
  ): Promise<UserProfile> {
    const { data, error } = await supabase
      .from("user_profiles")
      .update(updates)
      .eq("slack_user_id", slackUserId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update user profile", { error, slackUserId });
      throw error;
    }

    return data;
  },

  /**
   * Get profile by database ID
   */
  async getProfileById(profileId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", profileId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error("Failed to get profile", { error, profileId });
      throw error;
    }

    return data;
  },
};
