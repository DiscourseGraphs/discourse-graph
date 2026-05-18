import { getVariant, config } from "@repo/database/dbDotEnv";

const variant = getVariant();

if (variant !== "none" && variant !== "local") {
  console.error(
    "Tests are destructive, not running against production or branch",
  );
  process.exit(-1);
}
config();

process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;

if (process.env.SUPABASE_URL?.includes("supabase.com")) {
  throw new Error(
    "Integration tests must not run against production Supabase. Check SUPABASE_URL.",
  );
}
