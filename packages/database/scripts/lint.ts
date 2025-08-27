import { exec } from "node:child_process";
import { readdir, Dirent } from "node:fs";
import { join, dirname } from "path";

const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

const main = () => {
  try {
    exec("which sqruff", (err) => {
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
    exec("which deno", (err) => {
      if (err) {
        console.error("Could not find deno, you may want to install it.");
        // Do not fail yet
      } else {
        const fnDir = join(projectRoot, "supabase", "functions");
        readdir(fnDir, { withFileTypes: true }, (err, files: Dirent[]) => {
          if (err) {
            console.error("error:", err);
            return;
          }
          files.forEach((file) => {
            if (file.isDirectory()) {
              exec(
                "deno lint index.ts",
                { cwd: join(file.path, file.name) },
                (err, stdout, stderr) => {
                  stderr = stderr.replace("Checked 1 file", "");
                  if (err !== null || stderr.trim().length > 0) {
                    console.error(
                      `deno errors for ${file.name}: ${err?.message ?? ""}\n${stdout}`,
                    );
                    denoError = true;
                  } else {
                    console.log(`deno checked types of ${file.name}`);
                  }
                },
              );
            }
          });
        });
      }
    });
    if (denoError) process.exit(1);
  } catch (error) {
    console.error("error:", error);
    process.exit(1);
  }
};
if (__filename === process.argv[1]) main();
