/* eslint-env node */
/* global require, module, __dirname */
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");
const console = require("node:console");
const dotenv = require("dotenv");

const findRoot = () => {
  let dir = __dirname;
  while (path.basename(dir) !== "database") {
    dir = path.dirname(dir);
  }
  return dir;
};

const getVariant = () => {
  const useDbArgPos = (process.argv || []).indexOf("--use-db");
  let variant =
    useDbArgPos > 0
      ? process.argv[useDbArgPos + 1]
      : process.env["SUPABASE_USE_DB"];
  if (variant === undefined) {
    dotenv.config();
    const dbGlobalEnv = path.join(findRoot(), ".env");
    if (fs.existsSync(dbGlobalEnv)) dotenv.config({ path: dbGlobalEnv });
    variant = process.env["SUPABASE_USE_DB"];
  }
  const processHasVars =
    !!process.env["SUPABASE_URL"] && !!process.env["SUPABASE_PUBLISHABLE_KEY"];

  if (
    ["local", "branch", "production", "none", "implicit", undefined].indexOf(
      variant,
    ) === -1
  ) {
    throw new Error("Invalid variant: " + variant);
  }

  if (
    process.env.HOME === "/vercel" ||
    (process.env.GITHUB_ACTIONS === "true" &&
      process.env.GITHUB_TEST !== "test")
  ) {
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
  process.env["SUPABASE_USE_DB"] = variant;
  return variant;
};

const envFilePath = () => {
  const variant = getVariant();
  if (variant === "implicit" || variant === "none") return null;
  const name = path.join(findRoot(), `.env.${variant}`);
  return fs.existsSync(name) ? name : null;
};

const envContents = () => {
  const path = envFilePath();
  if (!path) {
    /* eslint-disable @typescript-eslint/naming-convention */
    const raw = {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
      NEXT_API_ROOT: process.env.NEXT_API_ROOT,
    };
    /* eslint-enable @typescript-eslint/naming-convention */
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => !!v));
  }
  const data = fs.readFileSync(path, "utf8");
  return dotenv.parse(data);
};

let configDone = false;

const config = () => {
  if (configDone) return;
  const path = envFilePath();
  if (path) dotenv.config({ path });
  configDone = true;
};

module.exports = {
  getVariant,
  envFilePath,
  envContents,
  config,
};
