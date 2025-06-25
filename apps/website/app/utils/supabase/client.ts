import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Database } from "@repo/database/types.gen.ts";

// Inspired by https://supabase.com/ui/docs/nextjs/password-based-auth

export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing required Supabase environment variables");
  }
  return createSupabaseClient<Database, "public", Database["public"]>(url, key);
};
