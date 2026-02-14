import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@repo/database/dbTypes";
import { envContents } from "@repo/database/dbDotEnv";

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
