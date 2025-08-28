import { execSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { Vercel } from "@vercel/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

if (process.env.HOME === "/vercel") process.exit(0);

dotenv.config();

const variant =
  (process.argv.length === 3
    ? process.argv[2]
    : process.env["SUPABASE_USE_DB"]) || "local";

if (["local", "branch", "production", "all"].indexOf(variant) === -1) {
  console.error("Invalid variant: " + variant);
  process.exit(-1);
}

// option to override in .env, but otherwise use our values
const projectIdOrName: string =
  process.env["VERCEL_PROJECT_ID"] ||
  process.env["VERCEL_PROJECT_NAME"] ||
  "discourse-graph";
const baseParams: Record<string, string> = {};
const vercelToken = process.env["VERCEL_TOKEN"];

const makeLocalEnv = () => {
  const stdout = execSync("supabase status -o env", {
    encoding: "utf8",
  });
  const prefixed = stdout
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) =>
      /^API_URL=/.test(line)
        ? `SUPABASE_URL=${line.substring(8)}`
        : `SUPABASE_${line}`,
    )
    .join("\n");
  writeFileSync(
    join(projectRoot, ".env.local"),
    prefixed + '\nNEXT_API_ROOT="http://localhost:3000/api"\n',
  );
};

const makeBranchEnv = async (vercel: Vercel) => {
  let branch: string;
  if (process.env.SUPABASE_GIT_BRANCH) {
    // allow to override current branch
    // currently test with ENG-589-create-space-fn
    branch = process.env.SUPABASE_GIT_BRANCH;
  } else {
    const stdout = execSync("git status -b -uno", { encoding: "utf8" });
    const branchM = stdout.match(/On branch (.*)/)?.[1];
    if (branchM) branch = branchM;
    else throw new Error("Could not find the git branch");
  }
  if (!/^[-\w]+$/.test(branch))
    throw new Error("Invalid branch name: " + branch);
  const result = await vercel.deployments.getDeployments({
    ...baseParams,
    projectId: projectIdOrName,
    limit: 1,
    branch,
    state: "READY",
  });
  if (result.deployments.length === 0) {
    console.warn("No deployment for branch " + branch);
    return;
  }
  const url = result.deployments[0]!.url;
  try {
    execSync(
      `vercel -t ${vercelToken} env pull --environment preview --git-branch ${branch} .env.branch`,
      { encoding: "utf8" },
    );
  } catch (err) {
    console.error(err);
    throw err;
  }

  appendFileSync(".env.branch", `NEXT_API_ROOT="${url}/api"\n`);
};

const makeProductionEnv = async (vercel: Vercel) => {
  const result = await vercel.deployments.getDeployments({
    ...baseParams,
    projectId: projectIdOrName,
    limit: 1,
    target: "production",
    state: "READY",
  });
  if (result.deployments.length == 0) {
    throw new Error("No production deployment found");
  }
  const url = result.deployments[0]!.url;
  console.log(url);
  execSync(
    `vercel -t ${vercelToken} env pull --environment production .env.production`,
  );
  appendFileSync(".env.production", `NEXT_API_ROOT="${url}/api"\n`);
};

try {
  if (variant === "local" || variant === "all") {
    makeLocalEnv();
    if (variant === "local") process.exit(0);
  }
  if (!vercelToken) {
    console.error("Missing VERCEL_TOKEN in .env");
    process.exit(-1);
  }
  // option to override in .env, but otherwise use our values
  const teamId = process.env["VERCEL_TEAM_ID"];
  const teamSlug = process.env["VERCEL_TEAM_SLUG"] || "discourse-graphs";
  if (teamId) {
    baseParams.teamId = teamId;
  } else {
    baseParams.slug = teamSlug;
  }
  const vercel = new Vercel({ bearerToken: vercelToken });
  if (variant === "branch" || variant === "all") {
    await makeBranchEnv(vercel);
  }
  if (variant === "production" || variant === "all") {
    await makeProductionEnv(vercel);
  }
} catch (err) {
  console.error(err);
  throw err;
}
