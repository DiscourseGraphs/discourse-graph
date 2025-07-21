import dotenv from "dotenv";
import fs from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  // console.log("Using variant: " + variant);
  return variant;
};

export const envFilePath = () => {
  const variant: string | null = getVariant();
  if (variant === null) return null;
  return join(__dirname, `.env.${variant}`);
};

export const envContents = () => {
  const path = envFilePath();
  if (!path)
    return {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    };
  const data = fs.readFileSync(path, "utf8");
  return dotenv.parse(data);
};

let CONFIG_DONE = false;

export const config = () => {
  if (CONFIG_DONE) return;
  const path = envFilePath();
  if (path) dotenv.config({ path });
  CONFIG_DONE = true;
};
