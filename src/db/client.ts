import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.ts";

// Create Supabase client
// Note: Using untyped client for simplicity, casting results in services
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);
