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

type PublishConfig = {
  version: string;
  createRelease: boolean;
  targetRepo: string;
  isPrerelease: boolean;
};

type ExecOptions = {
  env?: Record<string, string>;
  cwd?: string;
};

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

const REQUIRED_BUILD_FILES = [
  "main.js",
  "manifest.json",
  "styles.css",
] as const;

const TARGET_REPO = "DiscourseGraphs/discourse-graph-obsidian";
const OWNER = "DiscourseGraphs";
const REPO = "discourse-graph-obsidian";

const log = (message: string): void => {
  console.log(`[Obsidian Publisher] ${message}`);
};

const getEnvVar = (
  name: string,
  required = false,
  defaultValue = "",
): string => {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value || defaultValue;
};

const parseArgs = (): PublishConfig => {
  const args = process.argv.slice(2);
  const config: Partial<PublishConfig> = {
    createRelease: false,
    targetRepo: TARGET_REPO,
    isPrerelease: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--version":
      case "-v":
        if (!nextArg || nextArg.startsWith("-")) {
          throw new Error("Version argument is required after --version");
        }
        config.version = nextArg;
        i++;
        break;
      case "--create-release":
      case "-r":
        config.createRelease = true;
        break;
      case "--target-repo":
        if (!nextArg || nextArg.startsWith("-")) {
          throw new Error(
            "Repository argument is required after --target-repo",
          );
        }
        config.targetRepo = nextArg;
        i++;
        break;
      case "--stable":
        config.isPrerelease = false;
        break;
      case "--help":
      case "-h":
        showHelp();
        process.exit(0);
    }
  }

  if (!config.version) {
    throw new Error("Version is required. Use --version <version> or --help");
  }

  validateVersion(config.version);
  return config as PublishConfig;
};

const validateVersion = (version: string): void => {
  const versionRegex = /^\d+\.\d+\.\d+(-[\w\.-]+)?$/;
  if (!versionRegex.test(version)) {
    throw new Error(
      `Invalid version format: ${version}. Expected format: x.y.z or x.y.z-suffix`,
    );
  }
};

const showHelp = (): void => {
  console.log(`
Usage: tsx scripts/publish-obsidian.ts --version <version> [options]

Required:
  --version, -v <version>    Version to publish (e.g., 0.1.0-beta.1)

Options:
  --create-release, -r      Create a GitHub release
  --target-repo <repo>      Target repository
  --stable                 Mark as stable release (defaults to pre-release if not specified)
  --help, -h               Show this help message
`);
};

const execCommand = async (
  command: string,
  options: ExecOptions = {},
): Promise<string> => {
  try {
    const { stdout, stderr } = await execPromise(command, {
      ...options,
      env: {
        ...process.env,
        ...options.env,
        GIT_ASKPASS: "echo",
        GIT_TERMINAL_PROMPT: "0",
      },
    });

    log(`Command: ${command}`);
    log(`stdout: ${stdout.trim()}`);
    if (stderr) log(`stderr: ${stderr.trim()}`);

    return stdout.trim();
  } catch (error) {
    const token = getEnvVar("OBSIDIAN_PLUGIN_REPO_TOKEN");
    if (token) {
      throw new Error((error as Error).message.replace(token, "***"));
    }
    throw error;
  }
};

const shouldExclude = (filePath: string, baseDir: string): boolean => {
  const relativePath = path.relative(baseDir, filePath);
  return EXCLUDE_PATTERNS.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp(pattern.replace(/\*/g, ".*"));
      return regex.test(relativePath) || regex.test(path.basename(filePath));
    }
    return (
      relativePath.includes(pattern) || path.basename(filePath) === pattern
    );
  });
};

const copyDirectory = (src: string, dest: string, baseDir: string): void => {
  if (!fs.existsSync(src)) {
    throw new Error(`Source directory does not exist: ${src}`);
  }

  fs.mkdirSync(dest, { recursive: true });

  fs.readdirSync(src, { withFileTypes: true }).forEach((entry) => {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (shouldExclude(srcPath, baseDir)) {
      log(`Excluding: ${path.relative(baseDir, srcPath)}`);
      return;
    }

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath, baseDir);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
};

const buildPlugin = async (dir: string): Promise<void> => {
  log("Building plugin...");

  await execCommand("npm run build", { cwd: dir });

  const buildDir = path.join(dir, "dist");
  const missingFiles = REQUIRED_BUILD_FILES.filter(
    (file) => !fs.existsSync(path.join(buildDir, file)),
  );

  if (missingFiles.length > 0) {
    throw new Error(`Required build files missing: ${missingFiles.join(", ")}`);
  }
};

const updateManifest = (tempDir: string, version: string): void => {
  const manifestPath = path.join(tempDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error("manifest.json not found in temp directory");
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.version = version;
  manifest.id = manifest.id.startsWith("@") ? "discourse-graphs" : manifest.id;

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  log(`Updated manifest version to ${version}`);
};

const copyBuildFiles = (buildDir: string, tempDir: string): void => {
  REQUIRED_BUILD_FILES.forEach((file) => {
    const srcPath = path.join(buildDir, file);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(tempDir, file));
      log(`Copied ${file}`);
    }
  });
};

const pushToRepo = async (
  tempDir: string,
  targetRepo: string,
  version: string,
): Promise<void> => {
  log(`Pushing to repository: ${targetRepo}...`);

  const token = getEnvVar("OBSIDIAN_PLUGIN_REPO_TOKEN");
  const repoUrl = token
    ? `https://${token}@github.com/${targetRepo}.git`
    : `git@github.com:${targetRepo}.git`;

  await execCommand("git init", { cwd: tempDir });
  await execCommand("git add .", { cwd: tempDir });
  await execCommand(`git commit -m "Release v${version}"`, { cwd: tempDir });
  await execCommand(`git remote add origin ${repoUrl}`, { cwd: tempDir });
  await execCommand("git branch -M main", { cwd: tempDir });
  await execCommand("git push -f origin main", { cwd: tempDir });
};

const createGithubRelease = async (
  tempDir: string,
  version: string,
  isPrerelease: boolean,
): Promise<void> => {
  log("Creating GitHub release...");

  const token = getEnvVar("OBSIDIAN_PLUGIN_REPO_TOKEN", true);
  const octokit = new Octokit({ auth: token });
  const owner = OWNER;
  const repo = REPO;
  const tagName = `v${version}`;

  // Create zip archive
  const zipName = `discourse-graph-v${version}.zip`;
  await execCommand(`zip -r ${zipName} . -x "*.git*"`, { cwd: tempDir });

  // Create release
  const release = await octokit.request("POST /repos/{owner}/{repo}/releases", {
    owner,
    repo,
    tag_name: tagName,
    name: `Discourse Graph v${version}`,
    prerelease: isPrerelease,
    generate_release_notes: true,
  });

  if (!release.data.upload_url) {
    throw new Error("Failed to get upload URL from release response");
  }

  // Upload assets
  const files = [...REQUIRED_BUILD_FILES, zipName];
  for (const file of files) {
    const filePath = path.join(tempDir, file);
    if (!fs.existsSync(filePath)) continue;

    const contentType =
      {
        ".js": "application/javascript",
        ".json": "application/json",
        ".css": "text/css",
        ".zip": "application/zip",
      }[path.extname(file)] || "application/octet-stream";

    const fileContent = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);
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

    log(`Uploaded ${file}`);
  }
};

const publish = async (config: PublishConfig): Promise<void> => {
  const { version, createRelease, targetRepo, isPrerelease } = config;
  const obsidianDir = path.resolve(".");
  const buildDir = path.join(obsidianDir, "dist");
  const tempDir = path.join(os.tmpdir(), "temp-obsidian-publish");

  try {
    log(`Publishing Obsidian plugin v${version}`);
    await buildPlugin(obsidianDir);

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }

    copyDirectory(obsidianDir, tempDir, obsidianDir);
    copyBuildFiles(buildDir, tempDir);
    updateManifest(tempDir, version);
    await pushToRepo(tempDir, targetRepo, version);

    if (createRelease) {
      await createGithubRelease(tempDir, version, isPrerelease);
    }

    log("Publication completed successfully!");
  } catch (error) {
    log(`Publication failed: ${error}`);
    throw error;
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  }
};

if (require.main === module) {
  publish(parseArgs()).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
