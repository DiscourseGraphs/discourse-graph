import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Database } from "@repo/database/types.gen.ts";

declare const SUPABASE_URL: string;
declare const SUPABASE_ANON_KEY: string;

// Inspired by https://supabase.com/ui/docs/react/password-based-auth

export const createClient = () => {
  return createSupabaseClient<Database, "public", Database["public"]>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  );
};
