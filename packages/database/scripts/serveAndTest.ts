import { execFileSync, execSync, spawn } from "node:child_process";
import { dirname, join } from "node:path";

const scriptDir = dirname(__filename);
const projectRoot = join(scriptDir, "..");
const functionUrl = "http://127.0.0.1:54321/functions/v1/create-space";
const readinessTimeoutMs = 120_000;

if (
  process.env.GITHUB_ACTIONS === "true" &&
  process.env.GITHUB_TEST !== "test"
) {
  console.error("Please set the GITHUB_TEST variable to 'test'");
  process.exit(2);
}
if (
  process.env.SUPABASE_USE_DB !== "local" &&
  process.env.SUPABASE_PROJECT_ID !== "test"
) {
  console.error(
    "Database tests require SUPABASE_USE_DB=local or SUPABASE_PROJECT_ID=test",
  );
  process.exit(2);
}

const wait = async (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const isFunctionRuntimeReady = async (): Promise<boolean> => {
  try {
    const response = await fetch(functionUrl, {
      body: "{}",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(2_000),
    });
    const body = await response.text();

    return !body.includes("name resolution failed");
  } catch {
    return false;
  }
};

const waitForFunctionRuntime = async ({
  getServeFailure,
}: {
  getServeFailure: () => Error | undefined;
}): Promise<void> => {
  const deadline = Date.now() + readinessTimeoutMs;

  while (Date.now() < deadline) {
    const serveFailure = getServeFailure();
    if (serveFailure) throw serveFailure;
    if (await isFunctionRuntimeReady()) return;
    await wait(500);
  }

  throw new Error("Timeout waiting for functions to serve");
};

const stopServeProcess = (servePid: number): void => {
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/pid", String(servePid), "/t", "/f"]);
      return;
    }

    process.kill(-servePid);
  } catch {
    console.error("Could not kill the functions serve process");
  }
};

const runTests = async (): Promise<void> => {
  let servePid: number | undefined;

  try {
    if (!(await isFunctionRuntimeReady())) {
      const serveCommand =
        process.platform === "win32"
          ? {
              args: ["/d", "/s", "/c", "supabase functions serve"],
              command: "cmd.exe",
            }
          : { args: ["functions", "serve"], command: "supabase" };
      const serve = spawn(serveCommand.command, serveCommand.args, {
        cwd: projectRoot,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let serveFailure: Error | undefined;

      servePid = serve.pid;
      serve.stdout.on("data", (data: Buffer) => console.log(data.toString()));
      serve.stderr.on("data", (data: Buffer) => console.error(data.toString()));
      serve.on("close", (code) => {
        if (code !== 0) {
          serveFailure = new Error(
            `supabase functions serve exited with code ${code ?? "unknown"}`,
          );
        }
      });
      serve.on("error", (error) => {
        serveFailure = error;
      });

      await waitForFunctionRuntime({ getServeFailure: () => serveFailure });
    }

    execSync(
      "node --import tsx ./node_modules/@cucumber/cucumber/bin/cucumber.js",
      { cwd: projectRoot, stdio: "inherit" },
    );
  } finally {
    if (servePid) stopServeProcess(servePid);
  }
};

runTests()
  .then(() => console.log("success"))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
