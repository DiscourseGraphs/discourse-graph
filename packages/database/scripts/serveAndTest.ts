import { spawn, execSync, ChildProcessByStdio } from "node:child_process";
import { join, dirname } from "path";
import type { Readable } from "node:stream";

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

process.env["SUPABASE_USE_DB"] = "local";

class ParallelServer {
  process: ChildProcessByStdio<null, Readable, null>;
  promise: Promise<boolean>;
  serveSuccess = false;
  resolveCallback:
    | ((value: boolean | PromiseLike<boolean>) => void)
    | undefined;
  rejectCallback: ((reason: unknown) => void) | undefined;
  timeoutClear: NodeJS.Timeout | undefined;
  constructor({
    cmd,
    args,
    readySignal,
    dir,
  }: {
    cmd: string;
    args: string[];
    readySignal: string;
    dir?: string;
  }) {
    this.process = spawn(cmd, args, {
      cwd: dir || projectRoot,
      detached: true,
      stdio: ["ignore", "pipe", "inherit"],
    });
    this.promise = new Promise((rsc, rjc) => {
      this.resolveCallback = rsc;
      this.rejectCallback = rjc;

      // Add timeout
      this.timeoutClear = setTimeout(() => {
        rjc(new Error("Timeout waiting for functions to serve"));
      }, 30000); // 30 second timeout
    });
    this.process.stdout.on("data", (data: Buffer) => {
      const output = data.toString();
      console.log(`stdout: ${output}`);
      if (output.includes(readySignal)) {
        console.log("Found serving functions");
        this.serveSuccess = true;
        clearTimeout(this.timeoutClear);
        if (this.resolveCallback === undefined)
          throw new Error("did not get callback");
        this.resolveCallback(true);
      }
    });
    this.process.on("close", () => {
      if (!this.serveSuccess && this.rejectCallback)
        this.rejectCallback(new Error("serve closed without being ready"));
    });
    this.process.on("error", (err) => {
      if (this.rejectCallback) this.rejectCallback(err);
    });
  }
}

const supabaseServer = new ParallelServer({
  cmd: "supabase",
  args: ["functions", "serve"],
  readySignal: "Serving functions ",
});

const nextServer = new ParallelServer({
  cmd: "npm",
  args: ["run", "dev"],
  readySignal: "Ready in ",
  dir: join(scriptDir, "../../../apps/website"),
});

const doTest = async () => {
  try {
    await Promise.all([supabaseServer.promise, nextServer.promise]);
    execSync("cucumber-js", {
      cwd: projectRoot,
      stdio: "inherit",
    });
    // will throw on failure
  } finally {
    if (supabaseServer.process.pid)
      try {
        process.kill(-supabaseServer.process.pid);
      } catch (e) {
        console.error("Could not kill the process");
        // maybe it just ended on its own.
      }
    if (nextServer.process.pid)
      try {
        process.kill(-nextServer.process.pid);
      } catch (e) {
        console.error("Could not kill the process");
        // maybe it just ended on its own.
      }
  }
};

doTest()
  .then(() => {
    console.log("success");
    clearTimeout(supabaseServer.timeoutClear);
    clearTimeout(nextServer.timeoutClear);
  })
  .catch((err) => {
    console.error(err);
    clearTimeout(supabaseServer.timeoutClear);
    clearTimeout(nextServer.timeoutClear);
    process.exit(1);
  });
