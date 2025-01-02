import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import util from 'util';
import { Octokit } from '@octokit/rest';

const execPromise = util.promisify(exec);

// Utility functions for generating unique identifiers
function generateTimestamp(): string {
  return new Date().toISOString().replace(/\D/g, '').slice(0, 14);
}

function generateRandomString(length: number = 8): string {
  return Math.random().toString(36).substring(2, 2 + length);
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
  repoUrl: 'https://github.com/DiscourseGraphs/roam-depot.git',
  targetFile: 'extension/DiscourseGraphs/discoursegraph.json',
  owner: 'DiscourseGraphs',
  repo: 'roam-depot',
  getBranchName: generateBranchName
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
    throw new Error('Unable to determine home directory');
  }
  return home;
}

// Execute git commands safely without exposing tokens
async function execGitCommand(command: string, options: Record<string, any> = {}): Promise<string> {
  const token = getRequiredEnvVar('GITHUB_TOKEN');
  try {
    const { stdout, stderr } = await execPromise(command, {
      ...options,
      env: {
        ...process.env,
        GIT_ASKPASS: 'echo',
        GIT_TERMINAL_PROMPT: '0'
      }
    });
    return stdout.trim();
  } catch (error) {
    const sanitizedError = new Error((error as Error).message.replace(token, '***'));
    throw sanitizedError;
  }
}

// Clone repository safely
async function cloneRepository(): Promise<void> {
  const token = getRequiredEnvVar('GITHUB_TOKEN');

  // First clone without authentication
  await execGitCommand(`git clone ${config.repoUrl} ${config.tempDir}`);
  
  // Set up the remote with credentials via git config
  await execGitCommand('git config --local credential.helper store', { cwd: config.tempDir });
  
  // Configure the credentials file separately
  const credentialsPath = path.join(getHomeDir(), '.git-credentials');
  await fs.writeFile(
    credentialsPath,
    `https://x-access-token:${token}@github.com\n`,
    { mode: 0o600 }
  );
  
  // Verify remote access
  await execGitCommand('git fetch origin', { cwd: config.tempDir });
}

// Get current commit hash
async function getCurrentCommitHash(): Promise<string> {
  return await execGitCommand('git rev-parse HEAD');
}

// Update JSON file with new commit hash
async function updateExtensionFile(commitHash: string): Promise<void> {
  const filePath = path.join(config.tempDir, config.targetFile);
  
  try {
    const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
    content.source_commit = commitHash;
    await fs.writeFile(filePath, JSON.stringify(content, null, 2));
  } catch (error) {
    throw new Error(`Failed to update extension file: ${(error as Error).message}`);
  }
}

// Create and push PR branch
async function createPullRequest(commitHash: string): Promise<void> {
  const branchName = config.getBranchName(commitHash);
  const commands = [
    `cd ${config.tempDir}`,
    `git config user.name "GitHub Actions"`,
    `git config user.email "actions@github.com"`,
    `git checkout -b ${branchName}`,
    'git add .',
    `git commit -m "Update source_commit to ${commitHash}"`,
    `git push origin ${branchName}`
  ];

  // Execute git commands with detailed error reporting
  for (const command of commands) {
    try {
      await execGitCommand(command);
    } catch (error) {
      throw new Error(`Failed at step "${command}": ${(error as Error).message}`);
    }
  }

  // Create PR using GitHub API
  try {
    const octokit = new Octokit({ auth: getRequiredEnvVar('GITHUB_TOKEN') });
    const { data: pr } = await octokit.pulls.create({
      owner: config.owner,
      repo: config.repo,
      title: `Update source_commit to ${commitHash}`,
      head: branchName,
      base: 'main',
      body: `Automated PR to update source_commit reference to ${commitHash}`
    });
    
    console.log(`Created PR #${pr.number}: ${pr.html_url}`);
  } catch (error) {
    throw new Error(`Failed to create PR: ${(error as Error).message}`);
  }
}

// Cleanup temporary directory
async function cleanup(): Promise<void> {
  try {
    await fs.rm(config.tempDir, { recursive: true, force: true });
    // Also clean up credentials file
    const credentialsPath = path.join(getHomeDir(), '.git-credentials');
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
    await createPullRequest(commitHash);

    console.log('Successfully created PR with updated source_commit');
  } catch (error) {
    console.error('Failed to update extension:', (error as Error).message);
    throw error;
  } finally {
    await cleanup();
  }
}

// CLI entry point
if (require.main === module) {
  updateExtension().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

export default updateExtension;