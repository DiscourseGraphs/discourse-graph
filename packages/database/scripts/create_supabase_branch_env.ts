import { execSync } from "node:child_process";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

if (process.env.HOME !== "/vercel") {
  try {
    const stdout = execSync(
      "git status -b -uno",
      { encoding: "utf8" },
    );
    const branchName = stdout.match(/On branch (.*)/)?.[1];
    if (!branchName) {
      throw new Error("Could not find branch name");
    }
    execSync(
      `vercel env pull --environment preview --git-branch ${branchName} .env.${branchName}`,
      { encoding: "utf8" },
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
}
