import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import type { Database } from "@repo/database/dbTypes";

export const createRequestSupabaseClient = (request: NextRequest) => {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    throw new Error("Missing Authorization header");
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing required Supabase environment variables");
  }

  return createSupabaseClient<Database, "public">(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });
};
