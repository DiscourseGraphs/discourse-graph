import { exec } from "node:child_process";
import { readdir, Dirent } from "node:fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const main = () => {
  try {
    exec("which sqruff", (err, stdout, stderr) => {
      if (err) {
        console.error("Could not find sqruff, you may want to install it.");
        // Do not fail yet
      } else {
        const command =
          process.argv.length == 3 && process.argv[2] == "-f" ? "fix" : "lint";
        exec(
          `sqruff ${command} supabase/schemas`,
          {},
          (err, stdout, stderr) => {
            console.log(`${stdout}`);
            console.log(`${stderr}`);
            process.exit(err ? err.code : 0);
          },
        );
      }
    });
    let denoError = false;
    exec("which deno", (err, stdout, stderr) => {
      if (err) {
        console.error("Could not find deno, you may want to install it.");
        // Do not fail yet
      } else {
        const fn_dir = join(projectRoot, "supabase", "functions");
        const fn_dirs = readdir(
          fn_dir,
          { withFileTypes: true },
          (err, files: Dirent[]) => {
            if (err) {
              console.error("error:", err);
              return;
            }
            files.forEach((file) => {
              if (file.isDirectory()) {
                exec(
                  `deno check -c ${join(file.path, file.name, "deno.json")} ${join(file.path, file.name, "index.ts")}`,
                  {},
                  (err, stdout, stderr) => {
                    if (err !== null || stderr.length > 0) {
                      console.error(
                        `deno errors for ${file.name}: ${err}\n${stderr}`,
                      );
                      denoError = true;
                    } else {
                      console.log(`deno checked types of ${file.name}`);
                    }
                  },
                );
              }
            });
          },
        );
      }
    });
    if (denoError) process.exit(1);
  } catch (error) {
    console.error("error:", error);
    process.exit(1);
  }
};
if (import.meta.url === `file://${process.argv[1]}`) main();
