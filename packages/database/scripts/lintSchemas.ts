import { exec } from "node:child_process";

const main = () => {
  try {
    exec("sqruff --version", (err) => {
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
            if (stderr) console.log(`${stderr}`);
            process.exit(err ? err.code : 0);
          },
        );
      }
    });
  } catch (error) {
    console.error("error:", error);
    process.exit(1);
  }
};
if (__filename === process.argv[1]) main();
