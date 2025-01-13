import { exec } from "child_process";
import util from "util";
import apiPut from "roamjs-components/util/apiPut";
import apiGet from "roamjs-components/util/apiGet";
import axios from "axios";

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

const writeFileToRepo = async (): Promise<{ status: number }> => {
  const gitHubAccessToken = getRequiredEnvVar("GITHUB_TOKEN");
  const privateKey = getRequiredEnvVar("APP_PRIVATE_KEY");
  const selectedRepo = `${config.owner}/${config.repo}`;

  let sha = "";
  console.log("Getting sha of the file");
  try {
    // get sha of the file use github app token
    const getResponse = await axios.get<{ sha: string }>(
      `https://api.github.com/repos/${selectedRepo}/contents/${config.targetFile}`,
      {
        headers: {
          Authorization: `Bearer ${gitHubAccessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    sha = getResponse.data.sha;
  } catch (error) {
    console.error("Failed to get sha of the file:", (error as Error).message);
    // console.error("Error:", error);
    throw error;
  }

  const content = JSON.stringify({
    name: "Test Extension",
    short_description: "Prints 'Test message 1'",
    author: "Nikita Prokopov",
    tags: ["print", "test"],
    source_url: "https://github.com/tonsky/roam-calculator",
    source_repo: "https://github.com/tonsky/roam-calculator.git",
    source_commit: getCurrentCommitHash(),
  });

  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(content);
  const base64Content = btoa(String.fromCharCode(...uint8Array));
  console.log("sha", sha);
  try {
    // https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28#create-or-update-file-contents
    const response = await axios.put(
      `https://api.github.com/repos/${selectedRepo}/contents/${config.targetFile}`,
      {
        message: `Add ${config.targetFile}`,
        content: base64Content,
        sha: sha,
      },
      {
        headers: {
          Authorization: `token ${privateKey}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    if (response.status === 401) {
      throw new Error("Authentication failed");
    }
    return { status: response.status };
  } catch (error) {
    const e = error as Error;
    console.error("final error", error);
    if (e.message.includes('"sha" wasn\'t supplied.')) {
      throw new Error("File already exists");
    }
    throw new Error("File already exists");
  }
};

// Main function with proper error handling
export async function updateExtension(): Promise<void> {
  try {
    await writeFileToRepo();

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
