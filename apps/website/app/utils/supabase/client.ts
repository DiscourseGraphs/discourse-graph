import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@repo/database/dbTypes";

export const createClient = () => {
  return createBrowserClient<Database, "public">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
};
