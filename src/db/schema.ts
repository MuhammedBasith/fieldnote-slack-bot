// Database types for Supabase tables

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  user_name: string | null;
  text: string;
  slack_ts: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  slack_user_id: string;
  writing_tone: string | null;
  stylistic_rules: string[];
  banned_phrases: string[];
  interests: string[];
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface DailyInsight {
  id: string;
  user_id: string;
  insight_date: string;
  topic: string;
  core_insight: string;
  supporting_context: string | null;
  status: "pending" | "posts_generated" | "sent" | "ignored";
  created_at: string;
}

export interface GeneratedPost {
  id: string;
  insight_id: string;
  platform: "x" | "linkedin";
  content: string;
  char_count: number;
  status: "draft" | "viewed" | "edited" | "published" | "ignored";
  created_at: string;
}

export interface DigestRun {
  id: string;
  slack_user_id: string;
  newest_message_ts: string;
  message_count: number;
  insight_count: number;
  created_at: string;
}

// Supabase Database type for typed queries
export interface Database {
  public: {
    Tables: {
      messages: {
        Row: Message;
        Insert: Omit<Message, "id" | "created_at">;
        Update: Partial<Omit<Message, "id">>;
      };
      user_profiles: {
        Row: UserProfile;
        Insert: Omit<UserProfile, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<UserProfile, "id" | "created_at">>;
      };
      daily_insights: {
        Row: DailyInsight;
        Insert: Omit<DailyInsight, "id" | "created_at">;
        Update: Partial<Omit<DailyInsight, "id" | "created_at">>;
      };
      generated_posts: {
        Row: GeneratedPost;
        Insert: Omit<GeneratedPost, "id" | "created_at">;
        Update: Partial<Omit<GeneratedPost, "id" | "created_at">>;
      };
    };
  };
}
