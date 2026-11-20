import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@repo/database/dbTypes";
import { envContents } from "@repo/database/dbDotEnv";
import type { DGSupabaseClient } from "@repo/database/lib/client";

// This is a supabase client to be used in a server process such as NextJS
// Inspired by https://supabase.com/ui/docs/nextjs/password-based-auth

export const createClient = async () => {
  const dbEnv = envContents();
  const cookieStore = await cookies();
  const supabaseUrl = dbEnv.SUPABASE_URL;
  const supabaseKey = dbEnv.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing required Supabase environment variables");
  }

  // following https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=environment&environment=server
  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => {
        return cookieStore.getAll();
      },
      setAll: (
        cookiesToSet: {
          name: string;
          value: string;
          options: CookieOptions;
        }[],
      ) => {
        try {
          cookiesToSet.forEach(
            ({
              name,
              value,
              options,
            }: {
              name: string;
              value: string;
              options: CookieOptions;
            }) => cookieStore.set(name, value, options),
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
};

// For callers signed in through a plugin rather than website cookies. Queries
// run as the token's user under RLS, so this must never take the service key.
export const createBearerTokenClient = (
  accessToken: string,
): DGSupabaseClient => {
  const dbEnv = envContents();
  if (!dbEnv.SUPABASE_URL || !dbEnv.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing required Supabase environment variables");
  }
  return createSupabaseClient<Database, "public">(
    dbEnv.SUPABASE_URL,
    dbEnv.SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
};
