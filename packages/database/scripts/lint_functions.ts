import { exec, spawnSync } from "node:child_process";
import { readdir, Dirent } from "node:fs";
import { join, dirname } from "path";

const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

const main = () => {
  try {
    let denoError = false;
    exec("which deno", (err) => {
      if (err) {
        console.error("Could not find deno, you may want to install it.");
        // Do not fail yet
      } else {
        const fnDir = join(projectRoot, "supabase", "functions");
        const fix = process.argv.length == 3 && process.argv[2] == "-f";
        readdir(fnDir, { withFileTypes: true }, (err, files: Dirent[]) => {
          if (err) {
            console.error("error:", err);
            return;
          }
          const dirs = files.filter((f) => f.isDirectory()).map((d) => d.name);
          for (const dir of dirs) {
            const args = ["lint"];
            if (fix) args.push("--fix");
            args.push("index.ts");
            const res = spawnSync("deno", args, { cwd: join(fnDir, dir) });
            const cleanedStderr = (res.stderr?.toString() ?? "")
              .replace("Checked 1 file", "")
              .trim();
            const out = (res.stdout?.toString() ?? "") + cleanedStderr;
            if (res.status !== 0 || cleanedStderr.length > 0) {
              console.error(`deno errors for ${dir}:\n${out}`);
              denoError = true;
            } else {
              console.log(`deno checked types of ${dir}`);
            }
          }
          if (denoError) process.exit(1);
        });
      }
    });
    // exit handled after linting completes
  } catch (error) {
    console.error("error:", error);
    process.exit(1);
  }
};
if (__filename === process.argv[1]) main();
