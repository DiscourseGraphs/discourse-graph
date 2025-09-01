import { execSync } from "node:child_process";
import { join, dirname } from "path";
import { getVariant } from "../src/dbDotEnv.mts";

const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

if (process.env.HOME !== "/vercel") {
  try {
    if (getVariant() === "none") {
      console.log("Not using the database");
      process.exit(0);
    }
    execSync("npm run serve", { cwd: projectRoot, stdio: "inherit" });
  } catch (err) {
    console.error(err);
    throw err;
  }
}
