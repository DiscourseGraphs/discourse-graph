import { exec } from "child_process";
import util from "util";
import apiPut from "roamjs-components/util/apiPut";
import apiGet from "roamjs-components/util/apiGet";
import axios from "axios";
import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";

const execPromise = util.promisify(exec);

const config = {
  tempDir: "/tmp/test-roam-depot",
  repoUrl: "https://github.com/DiscourseGraphs/test-roam-depot.git",
  targetFile: "extension/DiscourseGraphs/discourseGraph.json",
  owner: "DiscourseGraphs",
  repo: "test-roam-depot",
};

// Safe way to get environment variable with type checking
function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  console.log(`Env var ${name}: ${value}`);
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

// Execute git commands safely without exposing tokens

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

    // Log both stdout and stderr
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
// Get current commit hash
async function getCurrentCommitHash(): Promise<string> {
  return await execGitCommand("git rev-parse HEAD");
}

async function updateFileInOtherRepo() {
  // 1) Initialize Octokit using GitHub App credentials
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: parseInt(getRequiredEnvVar("APP_ID"), 10),
      privateKey: getRequiredEnvVar("APP_PRIVATE_KEY"),
      installationId: 59416220,
    },
  });
  // 2) (Optional) get commit hash from current repo
  const commitHash = await getCurrentCommitHash();
  console.log(`Current commit hash: ${commitHash}`);

  // 3) Build new file content
  const newContent = JSON.stringify({
    name: "Test Extension",
    short_description: "Prints 'Test message 1'",
    author: "Nikita Prokopov",
    tags: ["print", "test"],
    source_url: "https://github.com/tonsky/roam-calculator",
    source_repo: "https://github.com/tonsky/roam-calculator.git",
    source_commit: getCurrentCommitHash(),
  });

  const contentBase64 = Buffer.from(newContent).toString("base64");

  // 4) Get existing file’s SHA (so we can update it)
  let sha = "";
  try {
    const getResponse = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner: config.owner,
        repo: config.repo,
        path: config.targetFile,
      },
    );
    // The response data shape can differ, but typically { sha, content, ... }
    sha = (getResponse.data as { sha: string }).sha;
    console.log("File exists. Current SHA:", sha);
  } catch (error: any) {
    if (error.status === 404) {
      // File not found -> you could create it new
      console.log(
        `File not found. Will create a new one: ${config.targetFile}`,
      );
    } else {
      throw new Error(`Could not retrieve file: ${error.message}`);
    }
  }

  // 5) Update (or create) the file
  try {
    const response = await octokit.request(
      "PUT /repos/{owner}/{repo}/contents/{path}",
      {
        owner: config.owner,
        repo: config.repo,
        path: config.targetFile,
        message: `Update ${config.targetFile} from current repo`,
        content: contentBase64,
        sha, // omit `sha` if you want to create a file that doesn't exist yet
      },
    );

    console.log("Successfully updated/created file in other repo!");
    console.log("Response:", response.status);
  } catch (error: any) {
    throw new Error(`Failed to update file: ${error.message}`);
  }
}

// Main function with proper error handling
export async function updateExtension(): Promise<void> {
  try {
    await updateFileInOtherRepo();

    console.log("Successfully created PR with updated source_commit");
  } catch (error) {
    console.error("Failed to update extension:", (error as Error).message);
    throw error;
  }
}

// CLI entry point
if (require.main === module) {
  updateExtension().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export default updateExtension;
