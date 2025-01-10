import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import util from "util";
import { Octokit } from "@octokit/rest";

const execPromise = util.promisify(exec);

// Utility functions for generating unique identifiers
function generateTimestamp(): string {
  return new Date().toISOString().replace(/\D/g, "").slice(0, 14);
}

function generateRandomString(length: number = 8): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
}

function generateBranchName(commitHash: string): string {
  const timestamp = generateTimestamp();
  const shortHash = commitHash.slice(0, 7);
  return `update-source-commit-${timestamp}-${shortHash}`;
}

const config = {
  tempDir: "/tmp/test-roam-depot",
  repoUrl: "https://github.com/DiscourseGraphs/test-roam-depot.git",
  targetFile: "extension/DiscourseGraphs/discourseGraph.json",
  owner: "DiscourseGraphs",
  repo: "test-roam-depot",
  getBranchName: generateBranchName,
};

// Safe way to get environment variable with type checking
function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

// Get home directory safely
function getHomeDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) {
    throw new Error("Unable to determine home directory");
  }
  return home;
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
// Clone repository safely
async function cloneRepository(): Promise<void> {
  const token = getRequiredEnvVar("GITHUB_TOKEN");

  // Use git config instead of embedding token in URL
  await execGitCommand(`git clone ${config.repoUrl} ${config.tempDir}`);
  await execGitCommand(
    `git -C ${config.tempDir} config http.https://github.com/.extraheader "AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}"`,
  );
}

// Get current commit hash
async function getCurrentCommitHash(): Promise<string> {
  return await execGitCommand("git rev-parse HEAD");
}

// Update JSON file with new commit hash
async function updateExtensionFile(commitHash: string): Promise<void> {
  const filePath = path.join(config.tempDir, config.targetFile);

  try {
    const content = JSON.parse(await fs.readFile(filePath, "utf8"));
    content.source_commit = commitHash;
    await fs.writeFile(filePath, JSON.stringify(content, null, 2));
  } catch (error) {
    throw new Error(
      `Failed to update extension file: ${(error as Error).message}`,
    );
  }
}

// Commit
async function updateSourceCommit(commitHash: string): Promise<void> {
  const token = getRequiredEnvVar("GITHUB_TOKEN");

  const commands = [
    `pwd`,
    `git config user.name "GitHub Actions"`,
    `git config user.email "actions@github.com"`,
    `git add .`,
    `git commit -m "Update source_commit to ${commitHash}"`,
    // Set the remote URL with authentication before pushing
    `git remote set-url origin https://x-access-token:${token}@github.com/${config.owner}/${config.repo}.git`,
    `git push origin main`,
  ];

  // Execute git commands with detailed error reporting
  for (const command of commands) {
    try {
      // Don't log the command if it contains the token
      if (!command.includes(token)) {
        console.log(`Executing: ${command}`);
      }
      await execGitCommand(command, { cwd: config.tempDir });
      if (!command.includes(token)) {
        console.log(`Successfully executed: ${command}`);
      }
    } catch (error) {
      // Sanitize error message if it contains the token
      const sanitizedCommand = command.includes(token)
        ? command.replace(token, "***")
        : command;
      throw new Error(
        `Failed at step "${sanitizedCommand}": ${(error as Error).message}`,
      );
    }
  }

  // Reset the remote URL to remove the token
  await execGitCommand(
    `git remote set-url origin https://github.com/${config.owner}/${config.repo}.git`,
    { cwd: config.tempDir },
  );
}

// Cleanup temporary directory
async function cleanup(): Promise<void> {
  try {
    await fs.rm(config.tempDir, { recursive: true, force: true });
    const credentialsPath = path.join(getHomeDir(), ".git-credentials");
    await fs.unlink(credentialsPath).catch(() => {}); // Ignore if file doesn't exist
  } catch (error) {
    console.warn(`Cleanup failed: ${(error as Error).message}`);
  }
}

// Main function with proper error handling
export async function updateExtension(): Promise<void> {
  try {
    const commitHash = await getCurrentCommitHash();
    console.log(`Current commit hash: ${commitHash}`);

    await cloneRepository();
    await updateExtensionFile(commitHash);
    await updateSourceCommit(commitHash);

    console.log("Successfully created PR with updated source_commit");
  } catch (error) {
    console.error("Failed to update extension:", (error as Error).message);
    throw error;
  } finally {
    await cleanup();
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
