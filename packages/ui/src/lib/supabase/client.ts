import {
  type SupabaseClient,
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";
import { Database } from "@repo/database/types.gen.ts";

// Inspired by https://supabase.com/ui/docs/react/password-based-auth

export type DGSupabaseClient = SupabaseClient<
  Database,
  "public",
  Database["public"]
>;

export const createClient = (): DGSupabaseClient => {
  return createSupabaseClient<Database, "public", Database["public"]>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
  );
};
