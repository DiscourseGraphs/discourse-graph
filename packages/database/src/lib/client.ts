import {
  type SupabaseClient,
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";
import type { Database } from "@repo/database/dbTypes";

// Inspired by https://supabase.com/ui/docs/react/password-based-auth

export type DGSupabaseClient = SupabaseClient<Database, "public">;

let client: DGSupabaseClient | null | undefined = undefined;

export const createClient = (): DGSupabaseClient | null => {
  if (client === undefined) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      console.error("Missing required Supabase environment variables");
      client = null;
    } else {
      client = createSupabaseClient<Database, "public">(url, key);
    }
  }
  return client;
};
