import { execSync } from "node:child_process";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

if (process.env.HOME === "/vercel") process.exit(0);

const variant =
  (process.argv.length === 3
    ? process.argv[2]
    : process.env["SUPABASE_USE_DB"]) || "local";

if (["local", "branch", "production", "all"].indexOf(variant) === -1) {
  console.error("Invalid variant: " + variant);
  process.exit(-1);
}

if (variant === "local" || variant === "all") {
  try {
    const stdout = execSync("supabase status -o env", {
      encoding: "utf8",
    });
    const prefixed = stdout
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => `SUPABASE_${line}`)
      .join("\n");
    writeFileSync(join(projectRoot, ".env.local"), prefixed);
  } catch (err) {
    console.error(err);
    throw err;
  }
}
if (variant === "branch" || variant === "all") {
  try {
    const stdout = execSync("git status -b -uno", { encoding: "utf8" });
    const branchName = stdout.match(/On branch (.*)/)?.[1];
    if (!branchName) {
      throw new Error("Could not find branch name");
    }
    execSync(
      `vercel env pull --environment preview --git-branch ${branchName} .env.branch`,
      { encoding: "utf8" },
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
}
if (variant === "production" || variant === "all") {
  execSync("vercel env pull --environment preview .env.production");
}
