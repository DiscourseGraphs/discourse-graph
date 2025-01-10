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

function generateTempDir(): string {
  const timestamp = generateTimestamp();
  const random = generateRandomString();
  return `temp_roam_depot_${timestamp}_${random}`;
}

const config = {
  tempDir: generateTempDir(),
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

  // First clone without authentication
  await execGitCommand(`git clone ${config.repoUrl} ${config.tempDir}`);

  // Set up the remote with credentials via git config
  await execGitCommand("git config --local credential.helper store", {
    cwd: config.tempDir,
  });

  // Configure the credentials file separately
  const credentialsPath = path.join(getHomeDir(), ".git-credentials");
  await fs.writeFile(
    credentialsPath,
    `https://x-access-token:${token}@github.com\n`,
    { mode: 0o600 },
  );

  // Verify remote access
  await execGitCommand("git fetch origin", { cwd: config.tempDir });
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
  const commands = [
    `cd ${config.tempDir}`,
    `pwd`,
    `ls`,
    `git config user.name "GitHub Actions"`,
    `git config user.email "actions@github.com"`,

    `git checkout main`,

    // Pull to ensure you're up to date
    `git pull origin main --rebase`,
    `git remote add origin https://github.com/${config.owner}/${config.repo}.git`,

    `git add .`,
    `git commit -m "Update source_commit to ${commitHash}"`,
    // Force push to overwrite the branch
    `git push -f origin main`,
  ];

  // Execute git commands with detailed error reporting
  for (const command of commands) {
    try {
      await execGitCommand(command);
      console.log(`Successfully executed: ${command}`);
    } catch (error) {
      throw new Error(
        `Failed at step "${command}": ${(error as Error).message}`,
      );
    }
  }
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
