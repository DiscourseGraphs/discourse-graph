import { spawnSync } from "node:child_process";
import { opendirSync } from "node:fs";
import { join, dirname } from "node:path";
import { getVariant } from "@repo/database/dbDotEnv";

const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

if (process.env.HOME === "/vercel" || process.env.GITHUB_ACTIONS === "true") {
  console.log("Skipping in production environment");
  process.exit(0);
}

const argv = process.argv.slice(2);
const includeAll = argv.includes("--include-all");
const reapplyIdx = argv.indexOf("--reapply");
const reapply = reapplyIdx !== -1;
const reapplyVersion = reapply ? (argv[reapplyIdx + 1] ?? "") : "";
if (reapply && !reapplyVersion) {
  console.error("Missing <migration timestamp> after --reapply");
  process.exit(1);
}

if (getVariant() === "none") {
  console.log("Not using the database");
  process.exit(0);
}
if (
  getVariant() === "production" ||
  (getVariant() === "implicit" &&
    !(process.env.SUPABASE_URL || "").includes("127.0.0.1"))
) {
  console.log("Refusing to update the production database");
  process.exit(0);
}
const startResult = spawnSync("supabase", ["start"], {
  cwd: projectRoot,
  stdio: "inherit",
});
if (startResult.status) {
  process.exit(startResult.status);
}
if (reapply) {
  const dir = opendirSync(join(projectRoot, "supabase", "migrations"));
  const files = [];
  const fre = /^\d{14}_.*/;
  while (true) {
    const f = dir.readSync();
    if (f === null) {
      dir.closeSync();
      break;
    }
    if (fre.test(f.name)) {
      files.push(f.name.substring(0, 14));
    }
  }
  if (!files.length) {
    console.error("No migration files found");
    process.exit(1);
  }
  files.sort();
  const lastVersion = files[files.length - 1];
  if (reapplyVersion !== lastVersion) {
    console.error(
      `The expected migration version ${reapplyVersion} does not match the latest version ${lastVersion}.`,
    );
    process.exit(1);
  }
  console.log("Reverting migration " + reapplyVersion);
  const result = spawnSync(
    "supabase",
    ["migration", "repair", "--status", "reverted", "--local", reapplyVersion],
    {
      cwd: projectRoot,
      stdio: "inherit",
    },
  );
  if (result.status) {
    process.exit(result.status);
  }
}
let migrationArgs = ["migration", "up", "--local"];
if (includeAll) migrationArgs.push("--include-all");
const migrationResult = spawnSync("supabase", migrationArgs, {
  cwd: projectRoot,
});
const stderr = migrationResult.stderr?.toString() || "";
if (
  !includeAll &&
  migrationResult.status &&
  stderr.includes("with --include-all")
) {
  console.error(stderr);
  console.log("Consider trying again");
  process.exit(1);
}
if (migrationResult.status) {
  console.error(stderr);
  process.exit(migrationResult.status);
}
const migrationLines = stderr
  .split("\n")
  .filter((line) => line.startsWith("Applying migration "));

if (migrationLines.length > 0) {
  console.log(migrationLines.join("\n"));
  console.log("Migrations were applied, regenerating dbTypes");
  const generateResult = spawnSync("npm", ["run", "gentypes"], {
    cwd: projectRoot,
    stdio: "inherit",
  });
  if (generateResult.status) {
    console.error("Failed to generate types");
    process.exit(1);
  }
} else {
  console.log("No migrations were applied");
}
