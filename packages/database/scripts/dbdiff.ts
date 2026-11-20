import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";

const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");
const migrationsDir = join(projectRoot, "supabase", "migrations");

const usage = "Usage: tsx scripts/dbdiff.ts [--check | --save <name>]";

type Mode =
  | { kind: "report" }
  | { kind: "check" }
  | { kind: "save"; name: string };

const parseMode = (argv: string[]): Mode => {
  if (argv.includes("--check")) return { kind: "check" };
  const saveIdx = argv.indexOf("--save");
  if (saveIdx === -1) return { kind: "report" };
  const name = argv[saveIdx + 1] ?? "";
  if (!/^\w+$/.test(name)) {
    console.error(usage);
    process.exit(1);
  }
  return { kind: "save", name };
};

const listMigrations = (): Set<string> => new Set(readdirSync(migrationsDir));

const mode = parseMode(process.argv.slice(2));

// spawnSync blocks the event loop, so this handler runs only after sync exits;
// that lets the cleanup below run on Ctrl-C instead of leaving a file that the
// next `supabase db reset` would apply.
let interruptedBy: NodeJS.Signals | undefined;
const onSignal = (signal: NodeJS.Signals): void => {
  interruptedBy = signal;
};
process.on("SIGINT", onSignal);
process.on("SIGTERM", onSignal);

const before = listMigrations();
// Sync treats a leftover check file as an applied migration, which would hide
// the very difference this script is meant to report.
const leftovers = [...before].filter((f) =>
  /_dbdiff_check(_\d+)?\.sql$/.test(f),
);
if (leftovers.length) {
  console.error(
    `Delete these files from supabase/migrations first: ${leftovers.join(", ")}`,
  );
  process.exit(1);
}
let written: string[] = [];
let status: number | null = null;
try {
  // Declarative sync has no report-only mode: with --no-apply it writes the
  // difference as migration files but leaves the local database alone.
  const result = spawnSync(
    "supabase",
    [
      "db",
      "schema",
      "declarative",
      "sync",
      "--no-apply",
      "--name",
      mode.kind === "save" ? mode.name : "dbdiff_check",
    ],
    { cwd: projectRoot, stdio: "inherit" },
  );
  status = result.status;
} finally {
  // Sync may split one change over several files, so compare listings rather
  // than guess the names.
  written = [...listMigrations()].filter((f) => !before.has(f));
  if (mode.kind !== "save" || interruptedBy) {
    for (const f of written) rmSync(join(migrationsDir, f));
    if (written.length) console.log(`Removed ${written.join(", ")}`);
  }
}

if (interruptedBy) process.exit(130);
if (status !== 0) process.exit(status ?? 1);
if (mode.kind === "check" && written.length) {
  console.error("The schema files differ from the migrations.");
  process.exit(1);
}
