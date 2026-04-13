import { spawn, execSync } from "node:child_process";
import { join, dirname } from "path";

const scriptDir = dirname(__filename);
const projectRoot = join(scriptDir, "..");

if (
  process.env.GITHUB_ACTIONS === "true" &&
  process.env.GITHUB_TEST !== "test"
) {
  console.error("Please set the GITHUB_TEST variable to 'test'");
  process.exit(2);
}
if (process.env.SUPABASE_PROJECT_ID !== "test") {
  console.error("Please set the SUPABASE_PROJECT_ID variable to 'test'");
  process.exit(2);
}

const serve = spawn("supabase", ["functions", "serve"], {
  cwd: projectRoot,
  detached: true,
});

let resolveCallback: ((value: unknown) => void) | undefined = undefined;
let rejectCallback: ((reason: unknown) => void) | undefined = undefined;
let serveSuccess = false;
let timeoutClear: NodeJS.Timeout | undefined = undefined;

const servingReady = new Promise((rsc, rjc) => {
  resolveCallback = rsc;
  rejectCallback = rjc;

  // Add timeout
  timeoutClear = setTimeout(() => {
    rjc(new Error("Timeout waiting for functions to serve"));
  }, 30000); // 30 second timeout
});

serve.stdout.on("data", (data: Buffer) => {
  const output = data.toString();
  console.log(`stdout: ${output}`);
  if (output.includes("Serving functions ")) {
    console.log("Found serving functions");
    serveSuccess = true;
    clearTimeout(timeoutClear);
    if (resolveCallback === undefined) throw new Error("did not get callback");
    resolveCallback(null);
  }
});
serve.on("close", () => {
  if (!serveSuccess && rejectCallback)
    rejectCallback(new Error("serve closed without being ready"));
});
serve.on("error", (err) => {
  if (rejectCallback) rejectCallback(err);
});

const doTest = async () => {
  await servingReady;
  try {
    execSync("cucumber-js", {
      cwd: projectRoot,
      stdio: "inherit",
    });
    // will throw on failure
  } finally {
    if (serve.pid) process.kill(-serve.pid);
  }
};

doTest()
  .then(() => {
    console.log("success");
    clearTimeout(timeoutClear);
  })
  .catch((err) => {
    console.error(err);
    clearTimeout(timeoutClear);
    process.exit(1);
  });
