import {
  type SupabaseClient,
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";
import { Database } from "@repo/database/dbTypes";

// Inspired by https://supabase.com/ui/docs/react/password-based-auth

export type DGSupabaseClient = SupabaseClient<
  Database,
  "public",
  Database["public"]
>;

export const createClient = (): DGSupabaseClient => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing required Supabase environment variables");
  }

  return createSupabaseClient<Database, "public", Database["public"]>(url, key);
};
