import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(__dirname, "../../../packages/database/.env.local"),
});

if (process.env.SUPABASE_URL?.includes("supabase.co")) {
  throw new Error(
    "Integration tests must not run against production Supabase. Check SUPABASE_URL.",
  );
}
