import { execSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Vercel } from "@vercel/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const baseParams: Record<string, string> = {};

enum Variant {
  local = "local",
  branch = "branch",
  production = "production",
  all = "all",
  none = "none",
}

// option to override in .env, but otherwise use our values
const projectIdOrName: string =
  process.env["VERCEL_PROJECT_ID"] ||
  process.env["VERCEL_PROJECT_NAME"] ||
  "discourse-graph";

const getVercelToken = () => {
  dotenv.config();
  return process.env["VERCEL_TOKEN"];
};

const makeLocalEnv = () => {
  execSync("supabase start", {
    cwd: projectRoot, stdio: "inherit"
  });
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

const makeBranchEnv = async (vercel: Vercel, vercelToken: string) => {
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

const makeProductionEnv = async (vercel: Vercel, vercelToken: string) => {
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
  execSync(
    `vercel -t ${vercelToken} env pull --environment production .env.production`,
  );
  appendFileSync(".env.production", `NEXT_API_ROOT="${url}/api"\n`);
};

const main = async (variant: Variant) => {
  // Do not execute in deployment or github action.
  if (
    process.env.HOME === "/vercel" ||
    process.env.GITHUB_ACTIONS !== undefined
  )
    return;

  if (variant === Variant.none) return;

  try {
    if (variant === Variant.local || variant === Variant.all) {
      makeLocalEnv();
      if (variant === Variant.local) return;
    }
    const vercelToken = getVercelToken();
    if (!vercelToken) {
      throw Error("Missing VERCEL_TOKEN in .env");
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
    if (variant === Variant.branch || variant === Variant.all) {
      await makeBranchEnv(vercel, vercelToken);
    }
    if (variant === Variant.production || variant === Variant.all) {
      await makeProductionEnv(vercel, vercelToken);
    }
  } catch (err) {
    console.error("variant ", variant, " error ", err);
    throw err;
  }
};

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const variantS: string =
    (process.argv.length === 3
      ? process.argv[2]
      : process.env["SUPABASE_USE_DB"]) || "none";

  const variant = (Variant as Record<string, Variant>)[variantS];
  if (variant === undefined) {
    throw Error("Invalid variant: " + variant);
  }
  console.log(variant);
  await main(variant);
}
