import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/database/dbTypes";

// Inspired by https://supabase.com/ui/docs/react/password-based-auth

export type DGSupabaseClient = SupabaseClient<Database, "public">;
