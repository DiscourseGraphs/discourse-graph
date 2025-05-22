import { exec } from "node:child_process";
import dotenv from "dotenv";

dotenv.config();

const main = () => {
  try {
    exec("git status -s -b", (err, stdout, stderr) => {
      if (err) {
        console.error("Is git installed?");
        process.exit(1);
      }
      const lines = stdout.split("\n");
      if (lines[0] != "## main...main") {
        console.log("Not on main branch, not deploying database");
        process.exit(0);
      }
      const { SUPABASE_PROJECT_ID, SUPABASE_DB_PASSWORD } = process.env;
      if (!SUPABASE_PROJECT_ID) {
        console.log("Please define SUPABASE_PROJECT_ID");
        process.exit(1);
      }
      if (!SUPABASE_DB_PASSWORD) {
        console.log("Please define SUPABASE_DB_PASSWORD");
        process.exit(1);
      }
      // Use environment variables that are already set instead of passing as arguments
      exec(
        `supabase link --project-ref ${SUPABASE_PROJECT_ID}`,
        { env: { ...process.env, SUPABASE_DB_PASSWORD } },
        (err, stdout, stderr) => {
          console.log(`${stdout}`);
          console.error(`${stderr}`);
          if (err) {
            process.exit(err.code);
          }
          exec("supabase db push", (err, stdout, stderr) => {
            console.log(`${stdout}`);
            console.error(`${stderr}`);
            if (err) {
              process.exit(err.code);
            }
            if (process.argv.length == 3 && process.argv[2] == "-f") {
              // Also push functions
              exec(
                `supabase functions deploy --project-ref ${SUPABASE_PROJECT_ID}`,
                (err, stdout, stderr) => {
                  console.log(`${stdout}`);
                  console.error(`${stderr}`);
                  if (err) {
                    process.exit(err.code);
                  }
                },
              );
            }
          });
        },
      );
    });
  } catch (error) {
    console.error("error:", error);
    process.exit(1);
  }
};
if (import.meta.url === `file://${process.argv[1]}`) main();
