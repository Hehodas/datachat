import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type DataChatSupabaseClient = SupabaseClient;

let cachedClient: DataChatSupabaseClient | undefined;

export function createServerSupabaseClient(): DataChatSupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variables");
  }

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cachedClient;
}
