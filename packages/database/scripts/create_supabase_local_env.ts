import { execSync } from "node:child_process";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

if (process.env.HOME !== "/vercel") {
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
