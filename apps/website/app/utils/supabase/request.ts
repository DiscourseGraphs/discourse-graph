import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

import type { Database } from "@repo/database/dbTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";

export const createRequestSupabaseClient = ({
  request,
}: {
  request: NextRequest;
}): DGSupabaseClient => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing required Supabase environment variables");
  }

  const authorization = request.headers.get("authorization");
  return createClient<Database, "public">(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: authorization === null ? {} : { Authorization: authorization },
    },
  });
};
