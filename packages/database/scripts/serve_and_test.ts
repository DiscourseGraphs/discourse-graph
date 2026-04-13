import { spawn, execSync } from "node:child_process";
import { join, dirname } from "path";

const scriptDir = dirname(__filename);
const projectRoot = join(scriptDir, "..");

if (process.env.GITHUB_TEST !== "test") {
  console.error("Please set the GITHUB_TEST variable to 'test'");
}
if (process.env.SUPABASE_PROJECT_ID !== "test") {
  console.error("Please set the SUPABASE_PROJECT_ID variable to 'test'");
}

const serve = spawn("supabase", ["functions", "serve"], {
  cwd: projectRoot,
  detached: true,
});

let resolveCallback: ((v: unknown) => void) | undefined = undefined;

const servingReady = new Promise((rsc) => {
  resolveCallback = rsc;
});

serve.stdout.on("data", (data: string) => {
  console.log(`stdout: ${data}`);
  if (data.includes("Serving functions ")) {
    console.log("Found serving functions");
    if (resolveCallback === undefined) throw new Error("did not get callback");
    resolveCallback(null);
  }
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
  })
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  });
