import dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import util from "util";
import { Octokit } from "@octokit/core";
import { createAppAuth } from "@octokit/auth-app";

dotenv.config();

type ExtensionMetadata = {
  name: string;
  short_description: string;
  author: string;
  tags?: string[];
  source_url: string;
  source_repo: string;
  source_commit: string;
  source_subdir?: string;
  stripe_account?: string; // for payouts from Roam
};

const getVersion = (root = "."): string => {
  const filename = path.join(root, "package.json");
  const json = fs.existsSync(filename)
    ? JSON.parse(fs.readFileSync(filename).toString())
    : {};
  if (!json?.version) throw new Error(`No version found in ${filename}`);
  return json.version;
};

function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

const execPromise = util.promisify(exec);

async function execGitCommand(
  command: string,
  options: Record<string, any> = {},
): Promise<string> {
  const token = getRequiredEnvVar("GITHUB_TOKEN");
  try {
    const { stdout, stderr } = await execPromise(command, {
      ...options,
      env: {
        ...process.env,
        GIT_ASKPASS: "echo",
        GIT_TERMINAL_PROMPT: "0",
      },
    });

    console.log(`Command: ${command}`);
    console.log(`stdout: ${stdout.trim()}`);
    if (stderr) {
      console.log(`stderr: ${stderr.trim()}`);
    }

    return stdout.trim();
  } catch (error) {
    const sanitizedError = new Error(
      (error as Error).message.replace(token, "***"),
    );
    throw sanitizedError;
  }
}

async function getCurrentCommitHash(): Promise<string> {
  return await execGitCommand("git rev-parse HEAD");
}

const publish = async () => {
  process.env = {
    ...process.env,
    NODE_ENV: "production",
  };
  const username = "DiscourseGraphs";
  const publishRepo = "roam-depot";
  const destPath = `extensions/${username}/discourseGraph.json`;

  // 1) Initialize Octokit using GitHub App credentials
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: parseInt(getRequiredEnvVar("APP_ID"), 10),
      privateKey: getRequiredEnvVar("APP_PRIVATE_KEY"),
      installationId: 59416220,
    },
  });

  // 2) get commit hash from current repo
  const commitHash = await getCurrentCommitHash();
  console.log(`Current commit hash: ${commitHash}`);

  const metadata: ExtensionMetadata = {
    name: "Discourse Graph",
    short_description:
      "A tool and ecosystem for collaborative knowledge synthesis",
    author: "The Discourse Graphs Project",
    source_url: `https://github.com/DiscourseGraphs/discourse-graph`,
    source_repo: `https://github.com/DiscourseGraphs/discourse-graph.git`,
    source_commit: commitHash,
    source_subdir: "apps/roam",
  };

  const fileContent = JSON.stringify(metadata, null, 2);
  const base64Content = Buffer.from(fileContent).toString("base64");

  let sha = "";
  console.log("Getting sha of the file");
  try {
    const getResponse = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner: username,
        repo: publishRepo,
        path: destPath,
      },
    );
    sha = (getResponse.data as { sha: string }).sha;
    console.log("File exists. Current SHA:", sha);
  } catch (error: any) {
    if (error.status === 404) {
      // File not found -> you could create it new
      console.log(`File not found. Will create a new one: ${destPath}`);
    } else {
      throw new Error(`Could not retrieve file: ${error.message}`);
    }
  }

  console.log("Publishing ...");
  // 5) Update (or create) the file
  try {
    const version = getVersion();
    const message = "Release " + version;

    const response = await octokit.request(
      "PUT /repos/{owner}/{repo}/contents/{path}",
      {
        owner: username,
        repo: publishRepo,
        path: destPath,
        message: message,
        content: base64Content,
        sha,
      },
    );
    console.log(`Updating json at ${publishRepo}/${destPath} to github`);
    console.log("Response:", response.status);
  } catch (error: any) {
    throw new Error(`Failed to post to github: ${error}`);
  }
};

const main = async () => {
  try {
    await publish();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

if (require.main === module) main();
