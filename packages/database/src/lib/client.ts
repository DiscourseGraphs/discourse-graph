import {
  type SupabaseClient,
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";
import type { Database } from "@repo/database/dbTypes";

// Inspired by https://supabase.com/ui/docs/react/password-based-auth

export type DGSupabaseClient = SupabaseClient<Database, "public">;

export const createClient = (): DGSupabaseClient | null => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("Missing required Supabase environment variables");
    return null;
  }

  return createSupabaseClient<Database, "public">(url, key);
};
