import { execSync } from "node:child_process";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

if (process.env.HOME !== "/vercel") {
  try {
    execSync("supabase start");
    execSync("supabase migrations up");
    const stdout = execSync(
      "supabase gen types typescript --local --schema public",
      { encoding: "utf8" },
    );
    writeFileSync(join(projectRoot, "types.gen.ts"), stdout);
  } catch (err) {
    console.error(err);
    throw err;
  }
}
