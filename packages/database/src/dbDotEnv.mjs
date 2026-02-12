import { readFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Note: This file is written as mjs so it can be used before typescript compilation.
// This means the corresponding .d.ts file is currently maintained by hand.
// Remember to update it as needed.

const findRoot = () => {
  let dir = fileURLToPath(import.meta.url);
  while (basename(dir) !== "database") {
    dir = dirname(dir);
  }
  return dir;
};

export const getVariant = () => {
  const useDbArgPos = (process.argv || []).indexOf("--use-db");
  let variant =
    useDbArgPos > 0
      ? process.argv[useDbArgPos + 1]
      : process.env["SUPABASE_USE_DB"];
  if (variant === undefined) {
    dotenv.config();
    const dbGlobalEnv = join(findRoot(),'.env');
    if (existsSync(dbGlobalEnv))
      dotenv.config({path: dbGlobalEnv});
    variant = process.env["SUPABASE_USE_DB"];
  }
  const processHasVars =
    !!process.env["SUPABASE_URL"] && !!process.env["SUPABASE_ANON_KEY"];

  if (
    ["local", "branch", "production", "none", "implicit", undefined].indexOf(
      variant,
    ) === -1
  ) {
    throw new Error("Invalid variant: " + variant);
  }

  if (process.env.HOME === "/vercel" || process.env.GITHUB_ACTIONS === "true") {
    // deployment should have variables
    if (!processHasVars) {
      console.error("Missing SUPABASE variables in deployment");
      variant = "none";
    } else {
      variant = "implicit";
    }
  }
  if (variant === undefined) {
    if (processHasVars) {
      console.warn(
        "please define explicitly which database to use (set SUPABASE_USE_DB)",
      );
      variant = "implicit";
    } else {
      console.warn("Not using the database");
      variant = "none";
    }
  }
  // avoid repeating warnings
  process.env["SUPABASE_USE_DB"] = variant;
  return variant;
};

export const envFilePath = () => {
  const variant = getVariant();
  if (variant === "implicit" || variant === "none") return null;
  const name = join(findRoot(), `.env.${variant}`);
  return existsSync(name) ? name : null;
};

export const envContents = () => {
  const path = envFilePath();
  if (!path) {
    // Fallback to process.env when running in production environments
    const raw = {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      NEXT_API_ROOT: process.env.NEXT_API_ROOT,
    };
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => !!v));
  }
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
