import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(__dirname, "../../../packages/database/.env.local"),
});

process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;

if (process.env.SUPABASE_URL?.includes("supabase.com")) {
  throw new Error(
    "Integration tests must not run against production Supabase. Check SUPABASE_URL.",
  );
}
