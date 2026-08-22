import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type DataChatSupabaseClient = SupabaseClient;

export function createServerSupabaseClient(): DataChatSupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variables");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
