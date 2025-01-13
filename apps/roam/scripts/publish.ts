import dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import axios from "axios";
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
  console.log(`Env var ${name}: ${value}`);
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
  const destPath = `extensions/${username}/discourse-graph`;

  let sha = "";
  console.log("Getting sha of the file");
  try {
    const gitHubAccessToken = getRequiredEnvVar("GITHUB_TOKEN");
    if (!gitHubAccessToken) throw new Error("GITHUB_TOKEN is not set");
    const getResponse = await axios.get<{ sha: string }>(
      `https://api.github.com/repos/${username}/${publishRepo}/contents/${destPath}.json`,
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
    throw error;
  }

  console.log("Publishing ...");
  try {
    const privateKey = getRequiredEnvVar("MG_PAT");
    if (!privateKey) throw new Error("MG_PAT is not set");

    const version = getVersion();
    const message = "Release " + version;

    const metadata: ExtensionMetadata = {
      name: "Discourse Graph",
      short_description:
        "A tool and ecosystem for collaborative knowledge synthesis",
      author: "The Discourse Graphs Project",
      source_url: `https://github.com/DiscourseGraphs/discourse-graph`,
      source_repo: `https://github.com/DiscourseGraphs/discourse-graph.git`,
      source_commit: await getCurrentCommitHash(),
      source_subdir: "apps/roam",
    };
    const fileContent = JSON.stringify(metadata, null, 2);
    const base64Content = btoa(fileContent);

    const opts = {
      headers: {
        Authorization: `Bearer ${privateKey}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    };
    const url = `https://api.github.com/repos/${username}/${publishRepo}/contents/${destPath}.json`;
    const data = {
      message,
      sha,
      content: base64Content,
    };

    console.log(`Updating json at ${publishRepo}/${destPath} to github`);
    try {
      await axios.put(url, data, opts);
    } catch (error) {
      console.error("Failed to post to github", error);
      process.exit(1);
    }
  } catch (error) {
    console.error("Failed", error);
    process.exit(1);
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
