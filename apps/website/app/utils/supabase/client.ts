import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Database } from "@repo/database/types.gen.ts";
import { envContents } from "@repo/database/dbDotEnv";

// Inspired by https://supabase.com/ui/docs/nextjs/password-based-auth

export const createClient = () => {
  const dbEnv = envContents();
  const url = dbEnv.SUPABASE_URL;
  const key = dbEnv.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing required Supabase environment variables");
  }
  return createSupabaseClient<Database, "public", Database["public"]>(url, key);
};
