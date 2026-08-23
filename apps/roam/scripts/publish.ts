import dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import util from "util";

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
  stripe_account?: string;
};

type GitHubResponse = {
  data: unknown;
  status: number;
};

export type GitHubClient = {
  request: (
    route: string,
    parameters: Record<string, unknown>,
  ) => Promise<GitHubResponse>;
};

type PublishDependencies = {
  octokit?: GitHubClient;
  getCommitHash?: () => Promise<string>;
  getPackageVersion?: () => string;
};

type GitHubClientConstructor = new (options: {
  authStrategy: unknown;
  auth: {
    appId: number;
    privateKey: string;
    installationId: number;
  };
}) => GitHubClient;

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

const createGitHubClient = (): GitHubClient => {
  // Roam's script module configuration does not support ESM imports here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Octokit } = require("@octokit/core") as {
    Octokit: GitHubClientConstructor;
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createAppAuth } = require("@octokit/auth-app") as {
    createAppAuth: unknown;
  };

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: parseInt(getRequiredEnvVar("APP_ID"), 10),
      privateKey: getRequiredEnvVar("APP_PRIVATE_KEY"),
      installationId: 59416220,
    },
  });
};

const getGitHubApiErrorDetails = (error: unknown): string => {
  if (!error || typeof error !== "object") return String(error);

  const apiError = error as {
    message?: string;
    status?: number;
    response?: { data?: { message?: string } };
  };
  const message = apiError.response?.data?.message || apiError.message;

  if (apiError.status && message) return `${apiError.status}: ${message}`;
  if (apiError.status) return String(apiError.status);
  return message || "Unknown GitHub API error";
};

export const synchronizeFork = async ({
  octokit,
  owner,
  repo,
}: {
  octokit: GitHubClient;
  owner: string;
  repo: string;
}): Promise<void> => {
  let defaultBranch: string;

  try {
    const response = await octokit.request("GET /repos/{owner}/{repo}", {
      owner,
      repo,
    });
    defaultBranch =
      (response.data as { default_branch?: string }).default_branch || "";
  } catch (error) {
    throw new Error(
      `Could not determine the default branch for ${owner}/${repo}: GitHub API returned ${getGitHubApiErrorDetails(error)}. Verify the GitHub App can read the fork, then rerun the publish workflow. Metadata was not updated.`,
    );
  }

  if (!defaultBranch) {
    throw new Error(
      `Could not determine the default branch for ${owner}/${repo}: the GitHub API response did not include default_branch. Metadata was not updated.`,
    );
  }

  console.log(`Synchronizing ${owner}/${repo}:${defaultBranch} with upstream`);
  try {
    await octokit.request("POST /repos/{owner}/{repo}/merge-upstream", {
      owner,
      repo,
      branch: defaultBranch,
    });
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? (error as { status?: number }).status
        : undefined;

    if (status === 409) {
      throw new Error(
        `Could not synchronize ${owner}/${repo}:${defaultBranch} with upstream because the branches have conflicts. Resolve the fork conflicts in GitHub, then rerun the publish workflow. Metadata was not updated.`,
      );
    }

    throw new Error(
      `Could not synchronize ${owner}/${repo}:${defaultBranch} with upstream: GitHub API returned ${getGitHubApiErrorDetails(error)}. Verify the GitHub App permissions and fork state, then rerun the publish workflow. Metadata was not updated.`,
    );
  }

  console.log(
    `${owner}/${repo}:${defaultBranch} is synchronized with upstream`,
  );
};

export const publish = async ({
  octokit = createGitHubClient(),
  getCommitHash = getCurrentCommitHash,
  getPackageVersion = getVersion,
}: PublishDependencies = {}): Promise<void> => {
  process.env = {
    ...process.env,
    NODE_ENV: "production",
  };
  const username = "DiscourseGraphs";
  const publishRepo = "roam-depot";
  const destPath = `extensions/${username}/discourse-graph.json`;

  await synchronizeFork({
    octokit,
    owner: username,
    repo: publishRepo,
  });

  const commitHash = await getCommitHash();
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
      console.log(`File not found. Will create a new one: ${destPath}`);
    } else {
      throw new Error(`Could not retrieve file: ${error.message}`);
    }
  }

  console.log("Publishing ...");
  try {
    const version = getPackageVersion();
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
