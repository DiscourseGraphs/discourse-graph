import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import util from 'util';

const execPromise = util.promisify(exec);

// Separate configuration for better maintainability
const config = {
  tempDir: 'temp_roam_depot',
  repoUrl: 'https://github.com/DiscourseGraphs/roam-depot.git',
  targetFile: 'extension/DiscourseGraphs/discoursegraph.json',
  branchName: 'update-source-commit'
};

// Execute git commands safely without exposing tokens in logs
async function execGitCommand(command, options = {}) {
  try {
    const { stdout, stderr } = await execPromise(command, {
      ...options,
      // Prevent token from appearing in error messages
      env: {
        ...process.env,
        GIT_ASKPASS: 'echo',
        GIT_TERMINAL_PROMPT: '0'
      }
    });
    return stdout.trim();
  } catch (error) {
    // Sanitize error message to remove sensitive data
    const sanitizedError = new Error(`Git command failed: ${error.message.replace(process.env.GITHUB_TOKEN, '***')}`);
    throw sanitizedError;
  }
}

// Get current commit hash
async function getCurrentCommitHash() {
  return await execGitCommand('git rev-parse HEAD');
}

// Clone repository safely
async function cloneRepository() {
  // First clone without authentication
  await execGitCommand(`git clone ${config.repoUrl} ${config.tempDir}`);
  
  // Then set up the remote with credentials via git config
  await execGitCommand('git config --local credential.helper store', { cwd: config.tempDir });
  
  // Configure the credentials file separately to avoid command line exposure
  await fs.writeFile(
    path.join(process.env.HOME || process.env.USERPROFILE, '.git-credentials'),
    `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com\n`,
    { mode: 0o600 } // Secure file permissions
  );
  
  // Verify remote access
  await execGitCommand('git fetch origin', { cwd: config.tempDir });
}

// Update JSON file with new commit hash
async function updateExtensionFile(commitHash) {
  const filePath = path.join(config.tempDir, config.targetFile);
  const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
  content.source_commit = commitHash;
  await fs.writeFile(filePath, JSON.stringify(content, null, 2));
}

// Create and push PR branch
async function createPullRequest(commitHash) {
  const commands = [
    `cd ${config.tempDir}`,
    `git config user.name "GitHub Actions"`,
    `git config user.email "actions@github.com"`,
    `git checkout -b ${config.branchName}`,
    'git add .',
    `git commit -m "Update source_commit to ${commitHash}"`,
    `git push origin ${config.branchName}`
  ];

  for (const command of commands) {
    await execGitCommand(command);
  }
}

// Cleanup temporary directory
async function cleanup() {
  try {
    await fs.rm(config.tempDir, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Cleanup failed: ${error.message}`);
  }
}

// Main function with proper error handling
export async function updateExtension() {
  try {
    // Validate environment
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    const commitHash = await getCurrentCommitHash();
    console.log(`Current commit hash: ${commitHash}`);

    await cloneRepository();
    await updateExtensionFile(commitHash);
    await createPullRequest(commitHash);

    console.log('Successfully created PR with updated source_commit');
  } catch (error) {
    console.error('Failed to update extension:', error.message);
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