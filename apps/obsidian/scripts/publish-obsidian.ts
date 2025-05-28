#!/usr/bin/env tsx

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import util from "util";
import { Octokit } from "@octokit/core";
import os from "os";

dotenv.config();

const execPromise = util.promisify(exec);

// Files and directories to exclude (based on .gitignore and common patterns)
const EXCLUDE_PATTERNS = [
  "node_modules",
  "dist",
  ".env*",
  ".turbo",
  ".DS_Store",
  "*.log",
  "coverage",
  ".next",
  "out",
  "build",
  ".git",
  ".vscode",
  ".cursor",
  "*.pem",
  "temp-obsidian-publish",
];

type PublishConfig = {
  version: string;
  createRelease: boolean;
  targetRepo: string;
  isPrerelease: boolean;
};

function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

function getOptionalEnvVar(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

function parseArgs(): PublishConfig {
  const args = process.argv.slice(2);
  let version = "";
  let createRelease = false;
  let targetRepo = "DiscourseGraphs/discourse-graph-obsidian";
  let isPrerelease =
    getOptionalEnvVar("OBSIDIAN_IS_PRERELEASE", "true") === "true";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--version" || arg === "-v") {
      const nextArg = args[i + 1];
      if (!nextArg || nextArg.startsWith("-")) {
        throw new Error("Version argument is required after --version");
      }
      version = nextArg;
      i++; // Skip next argument since we consumed it
    } else if (arg === "--create-release" || arg === "-r") {
      createRelease = true;
    } else if (arg === "--target-repo") {
      const nextArg = args[i + 1];
      if (!nextArg || nextArg.startsWith("-")) {
        throw new Error("Repository argument is required after --target-repo");
      }
      targetRepo = nextArg;
      i++; // Skip next argument since we consumed it
    } else if (arg === "--stable") {
      isPrerelease = false;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: tsx scripts/publish-obsidian.ts --version <version> [options]

Required Arguments:
  --version, -v <version>       Version to publish (e.g., 0.1.0-beta.1)

Options:
  --create-release, -r          Create a GitHub release
  --target-repo <repo>          Target repository (default: from OBSIDIAN_TARGET_REPO env var)
  --stable                      Mark as stable release (not pre-release)
  --help, -h                    Show this help message

Environment Variables:
  GITHUB_TOKEN                  GitHub token for authentication (required)
  OBSIDIAN_TARGET_REPO          Default target repository
  OBSIDIAN_IS_PRERELEASE        Default pre-release setting (true/false)

Examples:
  tsx scripts/publish-obsidian.ts --version 0.1.0-beta.1 --create-release
  tsx scripts/publish-obsidian.ts --version 1.0.0 --create-release --stable
  tsx scripts/publish-obsidian.ts --version 0.2.0 --target-repo "YourOrg/your-plugin"
`);
      process.exit(0);
    } else {
      throw new Error(
        `Unknown argument: ${arg}. Use --help for usage information.`,
      );
    }
  }

  if (!version) {
    throw new Error(
      "Version is required. Use --version <version> or --help for usage information.",
    );
  }

  // Validate version format (basic semver check)
  const versionRegex = /^\d+\.\d+\.\d+(-[\w\.-]+)?$/;
  if (!versionRegex.test(version)) {
    throw new Error(
      `Invalid version format: ${version}. Expected format: x.y.z or x.y.z-suffix`,
    );
  }

  return {
    version,
    createRelease,
    targetRepo,
    isPrerelease,
  };
}

async function execCommand(
  command: string,
  options: Record<string, any> = {},
): Promise<string> {
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
    // Sanitize any potential tokens from error messages
    const token =
      process.env.GITHUB_TOKEN || process.env.OBSIDIAN_PLUGIN_REPO_TOKEN;
    if (token) {
      const sanitizedError = new Error(
        (error as Error).message.replace(token, "***"),
      );
      throw sanitizedError;
    }
    throw error;
  }
}

function log(message: string): void {
  console.log(`[Obsidian Publisher] ${message}`);
}

function shouldExclude(filePath: string, obsidianDir: string): boolean {
  const relativePath = path.relative(obsidianDir, filePath);
  return EXCLUDE_PATTERNS.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp(pattern.replace(/\*/g, ".*"));
      return regex.test(relativePath) || regex.test(path.basename(filePath));
    }
    return (
      relativePath.includes(pattern) || path.basename(filePath) === pattern
    );
  });
}

function copyDirectory(src: string, dest: string, obsidianDir: string): void {
  if (!fs.existsSync(src)) {
    throw new Error(`Source directory does not exist: ${src}`);
  }

  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (shouldExclude(srcPath, obsidianDir)) {
      log(`Excluding: ${path.relative(obsidianDir, srcPath)}`);
      continue;
    }

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath, obsidianDir);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function buildPlugin(obsidianDir: string): Promise<void> {
  log("Building Obsidian plugin...");

  const originalCwd = process.cwd();
  try {
    // Change to obsidian directory and run build
    process.chdir(obsidianDir);
    await execCommand("npm run build");

    // Verify build outputs exist
    const buildDir = path.join(obsidianDir, "dist");
    const requiredFiles = ["main.js", "manifest.json"];
    const optionalFiles = ["styles.css"];

    for (const file of requiredFiles) {
      const filePath = path.join(buildDir, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Required build output missing: ${file}`);
      }
    }

    for (const file of optionalFiles) {
      const filePath = path.join(buildDir, file);
      if (!fs.existsSync(filePath)) {
        log(`Optional build output missing: ${file} (this is okay)`);
      }
    }

    log("Build completed successfully");
  } finally {
    // Change back to original directory
    process.chdir(originalCwd);
  }
}

function updateManifestVersion(tempDir: string, version: string): void {
  const manifestPath = path.join(tempDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    throw new Error("manifest.json not found in temp directory");
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.version = version;

  // Ensure the plugin ID is compatible with Obsidian community plugins
  if (manifest.id.startsWith("@")) {
    manifest.id = "discourse-graphs";
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  log(`Updated manifest.json version to ${version}`);
}

function copyBuildArtifacts(buildDir: string, tempDir: string): void {
  log("Copying build artifacts...");

  const buildFiles = ["main.js", "manifest.json", "styles.css"];

  for (const file of buildFiles) {
    const srcPath = path.join(buildDir, file);
    const destPath = path.join(tempDir, file);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      log(`Copied ${file}`);
    } else if (file !== "styles.css") {
      // styles.css is optional
      throw new Error(`Required build file missing: ${file}`);
    }
  }
}

function cleanupTempDirectory(tempDir: string): void {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function prepareRepository(
  obsidianDir: string,
  buildDir: string,
  tempDir: string,
  version: string,
): void {
  log("Preparing repository content...");

  // Clean up any existing temp directory
  cleanupTempDirectory(tempDir);

  // Copy all obsidian files (excluding gitignored ones)
  copyDirectory(obsidianDir, tempDir, obsidianDir);

  // Copy build artifacts (this will overwrite the source files with built versions)
  copyBuildArtifacts(buildDir, tempDir);

  // Update version in manifest
  updateManifestVersion(tempDir, version);

  log("Repository content prepared");
}

async function pushToRepository(
  tempDir: string,
  targetRepo: string,
  version: string,
): Promise<void> {
  log(`Pushing to repository: ${targetRepo}...`);

  const originalCwd = process.cwd();
  try {
    // Initialize git in temp directory
    process.chdir(tempDir);

    await execCommand("git init");
    await execCommand("git add .");
    await execCommand(`git commit -m "Release v${version}"`);

    // Add remote and push
    const githubToken =
      process.env.GITHUB_TOKEN || process.env.OBSIDIAN_PLUGIN_REPO_TOKEN;
    const repoUrl = githubToken
      ? `https://${githubToken}@github.com/${targetRepo}.git`
      : `git@github.com:${targetRepo}.git`;

    await execCommand(`git remote add origin ${repoUrl}`);
    await execCommand("git branch -M main");
    await execCommand("git push -f origin main");

    log("Successfully pushed to repository");
  } finally {
    process.chdir(originalCwd);
  }
}

async function createRelease(
  tempDir: string,
  version: string,
  isPrerelease: boolean,
): Promise<void> {
  log("Creating GitHub release...");

  const originalCwd = process.cwd();
  try {
    const releaseFiles = ["main.js", "manifest.json"];
    const optionalFiles = ["styles.css"];

    // Check which files exist
    const existingFiles = releaseFiles.filter((file) =>
      fs.existsSync(path.join(tempDir, file)),
    );

    optionalFiles.forEach((file) => {
      if (fs.existsSync(path.join(tempDir, file))) {
        existingFiles.push(file);
      }
    });

    // Create a zip file with all content
    const zipName = `discourse-graph-v${version}.zip`;
    process.chdir(tempDir);
    await execCommand(`zip -r ${zipName} . -x "*.git*"`);

    // Create GitHub release using GitHub API
    const githubToken =
      process.env.GITHUB_TOKEN || process.env.OBSIDIAN_PLUGIN_REPO_TOKEN;

    if (!githubToken) {
      throw new Error(
        "GitHub token is required for creating releases. Set GITHUB_TOKEN or OBSIDIAN_PLUGIN_REPO_TOKEN environment variable.",
      );
    }

    const octokit = new Octokit({
      auth: githubToken,
    });

    const owner = "DiscourseGraphs";
    const repo = "discourse-graph-obsidian";
    const tagName = `v${version}`;

    // Create the release
    log("Creating release...");
    const release = await octokit.request(
      "POST /repos/{owner}/{repo}/releases",
      {
        owner,
        repo,
        tag_name: tagName,
        name: `Discourse Graph v${version}`,
        prerelease: isPrerelease,
        generate_release_notes: true,
      },
    );

    if (!release.data.upload_url) {
      throw new Error("Failed to get upload URL from release response");
    }

    log(`Created release: ${release.data.html_url}`);

    // Upload each asset
    for (const file of [...existingFiles, zipName]) {
      const filePath = path.join(tempDir, file);
      if (fs.existsSync(filePath)) {
        log(`Uploading asset: ${file}`);

        const contentType = file.endsWith(".js")
          ? "application/javascript"
          : file.endsWith(".json")
            ? "application/json"
            : file.endsWith(".css")
              ? "text/css"
              : "application/zip";

        const fileContent = fs.readFileSync(filePath);
        const stats = fs.statSync(filePath);

        // The upload_url includes a {?name,label} template that needs to be replaced
        const uploadUrl = release.data.upload_url.replace(
          "{?name,label}",
          `?name=${file}`,
        );

        await octokit.request(`POST ${uploadUrl}`, {
          headers: {
            "content-type": contentType,
            "content-length": String(stats.size),
          },
          data: fileContent,
          name: file,
        });

        log(`Successfully uploaded: ${file}`);
      }
    }

    log(`Release v${version} created successfully`);
  } catch (error) {
    log(`Warning: Failed to create release: ${error}`);
    log("Make sure you have the correct GitHub token and permissions");
    log("The token should have 'repo' permissions for the target repository");
    throw error; // Re-throw to ensure the error is properly handled
  } finally {
    process.chdir(originalCwd);
  }
}

const publish = async (config: PublishConfig): Promise<void> => {
  const {
    version,
    createRelease: createReleaseFlag,
    targetRepo,
    isPrerelease,
  } = config;

  // Paths
  const obsidianDir = path.resolve(".");
  const buildDir = path.join(obsidianDir, "dist");
  const tempDir = path.join(os.tmpdir(), "temp-obsidian-publish");

  try {
    log(`Starting publication of Obsidian plugin v${version}`);
    log(`Target repository: ${targetRepo}`);
    log(`Create release: ${createReleaseFlag ? "yes" : "no"}`);
    log(`Pre-release: ${isPrerelease ? "yes" : "no"}`);

    // Verify obsidian directory exists
    if (!fs.existsSync(obsidianDir)) {
      throw new Error("Current directory not found");
    }

    // Build the plugin
    await buildPlugin(obsidianDir);

    // Prepare repository content
    prepareRepository(obsidianDir, buildDir, tempDir, version);

    // Push to target repository
    await pushToRepository(tempDir, targetRepo, version);

    // Create release if requested
    if (createReleaseFlag) {
      await createRelease(tempDir, version, isPrerelease);
    } else {
      log("Skipping release creation");
    }

    log("Publication completed successfully!");
  } catch (error) {
    log(`Publication failed: ${error}`);
    throw error;
  } finally {
    // Cleanup
    cleanupTempDirectory(tempDir);
  }
};

const main = async (): Promise<void> => {
  try {
    const config = parseArgs();
    await publish(config);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

if (require.main === module) main();
