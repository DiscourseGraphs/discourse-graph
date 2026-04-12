import { spawn, execSync } from "node:child_process";
import { join, dirname } from "path";

const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

if (process.env.GITHUB_TEST !== "test") {
}

const serve = spawn("supabase", ["functions", "serve"], {
  cwd: projectRoot,
  detached: true,
});

let resolveCallback: ((v: unknown) => void) | undefined = undefined;
let rejectCallback: ((v: unknown) => void) | undefined = undefined;

const servingReady = new Promise((rsc, rjc) => {
  resolveCallback = rsc;
  rejectCallback = rjc;
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
