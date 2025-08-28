import dotenv from "dotenv";
import { readFileSync, existsSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const findRoot = (): string => {
  let dir = __filename;
  while (basename(dir) !== "database") {
    dir = dirname(dir);
  }
  return dir;
};

export const getVariant = (): string | null => {
  if (process.env.HOME === "/vercel" || process.env.GITHUB_ACTIONS === "true")
    return null;
  const useDbArgPos = process.argv.indexOf("--use-db");
  const variant =
    (useDbArgPos > 0
      ? process.argv[useDbArgPos + 1]
      : process.env["SUPABASE_USE_DB"]) || "local";

  if (["local", "branch", "production"].indexOf(variant) === -1) {
    throw new Error("Invalid variant: " + variant);
  }
  return variant;
};

export const envFilePath = () => {
  const variant: string | null = getVariant();
  if (variant === null) return null;
  const name = join(findRoot(), `.env.${variant}`);
  return existsSync(name) ? name : null;
};

export const envContents = () => {
  const path = envFilePath();
  if (!path)
    // Fallback to process.env when running in production environments
    return {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      NEXT_API_ROOT: process.env.NEXT_API_ROOT,
    };
  const data = readFileSync(path, "utf8");
  return dotenv.parse(data);
};

let configDone = false;

export const config = () => {
  if (configDone) return;
  const path = envFilePath();
  if (path) dotenv.config({ path });
  configDone = true;
};
