import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import util from "util";
import crypto from "crypto";
// https://linear.app/discourse-graphs/issue/ENG-766/upgrade-all-commonjs-to-esm
// TODO if possible: change apps/obsidian to ESM. Use require until then.
// import { Octokit } from "@octokit/core";
const { Octokit } = require("@octokit/core");
import os from "os";

dotenv.config();

const execPromise = util.promisify(exec);

type PublishConfig = {
  version: string;
  targetRepo: string;
  releaseName?: string;
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
const BLOB_UPLOAD_BATCH_SIZE = 10;
const MAX_GITHUB_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 2_000;

const TARGET_REPO = "DiscourseGraphs/discourse-graph-obsidian";
const OWNER = "DiscourseGraphs";
const REPO = "discourse-graph-obsidian";

const log = (message: string): void => {
  console.log(`[Obsidian Publisher] ${message}`);
};

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isSecondaryRateLimitError = (error: unknown): boolean => {
  const maybeError = error as {
    status?: number;
    response?: { data?: { message?: string } };
    message?: string;
  };
  const message =
    maybeError?.response?.data?.message?.toLowerCase() ??
    maybeError?.message?.toLowerCase() ??
    "";
  return maybeError?.status === 403 && message.includes("secondary rate limit");
};

const getRetryDelayMs = (error: unknown, attempt: number): number => {
  const maybeError = error as {
    response?: { headers?: Record<string, string | undefined> };
  };
  const retryAfterHeader = maybeError?.response?.headers?.["retry-after"];
  const retryAfterSeconds = Number(retryAfterHeader);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }
  return BASE_RETRY_DELAY_MS * 2 ** attempt;
};

const requestWithRetry = async <T = unknown>(
  request: () => Promise<T>,
  context: string,
): Promise<T> => {
  let attempt = 0;

  while (true) {
    try {
      return await request();
    } catch (error) {
      if (!isSecondaryRateLimitError(error) || attempt >= MAX_GITHUB_RETRIES) {
        throw error;
      }

      const delayMs = getRetryDelayMs(error, attempt);
      log(
        `Secondary rate limit hit during ${context}. Retrying in ${Math.ceil(delayMs / 1000)}s (attempt ${attempt + 1}/${MAX_GITHUB_RETRIES})...`,
      );
      await sleep(delayMs);
      attempt += 1;
    }
  }
};

const getAllFiles = (dir: string, baseDir: string = dir): string[] => {
  const files: string[] = [];

  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (shouldExclude(fullPath, baseDir)) {
      log(`Excluding: ${relativePath}`);
      return;
    }

    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else {
      files.push(relativePath);
    }
  });

  return files;
};

const getGitBlobSha = (content: Buffer): string => {
  const header = Buffer.from(`blob ${content.length}\0`, "utf8");
  return crypto
    .createHash("sha1")
    .update(Buffer.concat([header, content]))
    .digest("hex");
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const getEnvVar = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
};

const parseArgs = (): PublishConfig => {
  const args = process.argv.slice(2);
  const config: Partial<PublishConfig> = {
    targetRepo: TARGET_REPO,
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
      case "--release-name":
        if (!nextArg || nextArg.startsWith("-")) {
          throw new Error(
            "Release name argument is required after --release-name",
          );
        }
        config.releaseName = nextArg;
        i++;
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
  const basicVersionPattern = /^\d+\.\d+\.\d+/;

  if (!basicVersionPattern.test(version)) {
    throw new Error(
      `Invalid version format: ${version}. Expected format: x.y.z, x.y.z-suffix, or x.y.z-custom-name`,
    );
  }
};

const isExternalRelease = (version: string): boolean => {
  // External releases are:
  // 1. Stable releases (x.y.z)
  // 2. Beta releases (x.y.z-beta.n)

  // Stable release pattern (x.y.z)
  const stablePattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  if (stablePattern.test(version)) {
    return true;
  }

  // Beta release pattern (x.y.z-beta.n)
  const betaPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-beta(\.\d+)?$/;
  if (betaPattern.test(version)) {
    return true;
  }

  // Everything else (including alpha releases) is internal
  return false;
};

const showHelp = (): void => {
  console.log(`
Usage: tsx scripts/publish-obsidian.ts --version <version> [options]

Required:
  --version, -v <version>    Version to publish (see formats below)

Options:
  --release-name <name>    Custom release name (defaults to "Discourse Graph v{version}")
  --help, -h               Show this help message

Version Formats:
  x.y.z                    Stable release - auto-picked up by BRAT (e.g., 1.0.0)
  x.y.z-beta.n            Beta release - auto-picked up by BRAT (e.g., 1.0.0-beta.1)
  x.y.z-alpha-name        Internal release - manual install only (e.g., 0.1.0-alpha-canvas-feature)

Release Type Auto-Detection:
  - External releases (stable, beta): Auto-updated by BRAT users
  - Internal releases (alpha prefix): Marked as pre-release, manual install only

BRAT Version Priority:
  BRAT uses alphabetical ordering, so alpha < beta < stable
  - 0.1.0-alpha-feature (lowest priority)
  - 0.1.0-beta.1 (higher priority)
  - 0.1.0 (highest priority)

Examples:
  # Internal release with custom name
  tsx scripts/publish-obsidian.ts --version 0.1.0-alpha-canvas --release-name "Canvas Integration Feature"

  # Beta release with feature description
  tsx scripts/publish-obsidian.ts --version 1.0.0-beta.1 --release-name "Beta: New Graph View"

  # Stable release (uses default name)
  tsx scripts/publish-obsidian.ts --version 1.0.0
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

const copyDirectory = ({
  src,
  dest,
  baseDir,
}: {
  src: string;
  dest: string;
  baseDir: string;
}): void => {
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
      copyDirectory({ src: srcPath, dest: destPath, baseDir });
    } else {
      try {
        fs.copyFileSync(srcPath, destPath);
      } catch (error) {
        throw new Error(`Failed to copy ${srcPath}: ${error}`);
      }
    }
  });
};

const buildPlugin = async (dir: string): Promise<void> => {
  log("Building plugin...");

  await execCommand("pnpm run build", { cwd: dir });

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
  manifest.id = "discourse-graphs";

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

const updateMainBranch = async (
  tempDir: string,
  version: string,
): Promise<void> => {
  log(`Updating main branch of repository: ${TARGET_REPO}...`);

  const token = getEnvVar("OBSIDIAN_PLUGIN_REPO_TOKEN");
  const octokit = new Octokit({ auth: token });
  const owner = OWNER;
  const repo = REPO;

  try {
    const { data: ref } = await requestWithRetry<any>(
      () =>
        octokit.request("GET /repos/{owner}/{repo}/git/refs/{ref}", {
          owner,
          repo,
          ref: "heads/main",
        }),
      "fetching main branch ref",
    );

    if (!ref?.object?.sha) {
      throw new Error("Failed to get main branch reference");
    }
    const currentSha = ref.object.sha;

    const { data: currentCommit } = await requestWithRetry<any>(
      () =>
        octokit.request("GET /repos/{owner}/{repo}/git/commits/{commit_sha}", {
          owner,
          repo,
          commit_sha: currentSha,
        }),
      "fetching current main commit",
    );

    if (!currentCommit?.tree?.sha) {
      throw new Error("Failed to get current commit tree");
    }
    const currentTreeSha = currentCommit.tree.sha;
    const { data: existingTree } = await requestWithRetry<any>(
      () =>
        octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
          owner,
          repo,
          tree_sha: currentTreeSha,
          recursive: "1",
        }),
      "fetching recursive main tree",
    );

    const existingBlobShasByPath = new Map<string, string>(
      (existingTree.tree ?? [])
        .filter(
          (entry: any): entry is { path: string; sha: string; type: string } =>
            Boolean(entry.path && entry.sha && entry.type === "blob"),
        )
        .map((entry: { path: string; sha: string }) => [entry.path, entry.sha]),
    );

    const allFiles = getAllFiles(tempDir);
    log(`Found ${allFiles.length} files to update`);
    const normalizedAllFiles = allFiles.map((filePath) =>
      filePath.replace(/\\/g, "/"),
    );
    const currentRepoFiles = new Set<string>(existingBlobShasByPath.keys());
    const localFiles = new Set<string>(normalizedAllFiles);
    const filesToDelete = [...currentRepoFiles].filter(
      (repoFilePath) => !localFiles.has(repoFilePath),
    );
    const filesToUpdate = allFiles.filter((filePath) => {
      const fullPath = path.join(tempDir, filePath);
      const content = fs.readFileSync(fullPath);
      const normalizedPath = filePath.replace(/\\/g, "/");
      const existingSha = existingBlobShasByPath.get(normalizedPath);
      return getGitBlobSha(content) !== existingSha;
    });

    log(
      `Detected ${filesToUpdate.length} changed files (${allFiles.length - filesToUpdate.length} unchanged skipped)`,
    );
    log(`Detected ${filesToDelete.length} files to delete from target repo`);

    if (filesToUpdate.length === 0 && filesToDelete.length === 0) {
      log("No changes detected on main branch; skipping commit update");
      return;
    }

    const blobBatchChunks = chunk(filesToUpdate, BLOB_UPLOAD_BATCH_SIZE);
    const blobs: Array<{ path: string; sha: string }> = [];

    for (const [batchIndex, blobBatch] of blobBatchChunks.entries()) {
      log(
        `Uploading blob batch ${batchIndex + 1}/${blobBatchChunks.length} (${blobBatch.length} files)...`,
      );

      const batchBlobs = await Promise.all(
        blobBatch.map(async (filePath) => {
          const fullPath = path.join(tempDir, filePath);
          const content = fs.readFileSync(fullPath);

          const { data: blob } = await requestWithRetry<any>(
            () =>
              octokit.request("POST /repos/{owner}/{repo}/git/blobs", {
                owner,
                repo,
                content: content.toString("base64"),
                encoding: "base64",
              }),
            `creating blob for ${filePath}`,
          );

          if (!blob?.sha) {
            throw new Error(`Failed to create blob for ${filePath}`);
          }

          return {
            path: filePath.replace(/\\/g, "/"), // Normalize path separators for GitHub
            sha: blob.sha,
          };
        }),
      );

      blobs.push(...batchBlobs);
    }

    const treeUpdates = blobs.map((blob) => ({
      path: blob.path,
      mode: "100644" as const,
      type: "blob" as const,
      sha: blob.sha,
    }));
    const treeDeletions = filesToDelete.map((filePath) => ({
      path: filePath,
      mode: "100644" as const,
      type: "blob" as const,
      sha: null,
    }));

    const { data: newTree } = await requestWithRetry<any>(
      () =>
        octokit.request("POST /repos/{owner}/{repo}/git/trees", {
          owner,
          repo,
          base_tree: currentTreeSha,
          tree: [...treeUpdates, ...treeDeletions],
        }),
      "creating updated git tree",
    );

    if (!newTree?.sha) {
      throw new Error("Failed to create new tree");
    }

    const { data: newCommit } = await requestWithRetry<any>(
      () =>
        octokit.request("POST /repos/{owner}/{repo}/git/commits", {
          owner,
          repo,
          message: `Release v${version}`,
          tree: newTree.sha,
          parents: [currentSha],
        }),
      "creating release commit",
    );

    if (!newCommit?.sha) {
      throw new Error("Failed to create new commit");
    }

    await requestWithRetry(
      () =>
        octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
          owner,
          repo,
          ref: "heads/main",
          sha: newCommit.sha,
        }),
      "updating main branch reference",
    );

    log(`Successfully updated main branch with commit: ${newCommit.sha}`);
    log(
      `Updated ${blobs.length} files and deleted ${filesToDelete.length} files`,
    );
  } catch (error) {
    log(`Failed to update main branch: ${error}`);
    throw error;
  }
};

const createGithubRelease = async ({
  version,
  releaseName,
}: {
  version: string;
  releaseName?: string;
}): Promise<void> => {
  log("Creating GitHub release...");

  const token = getEnvVar("OBSIDIAN_PLUGIN_REPO_TOKEN");
  const octokit = new Octokit({ auth: token });
  const owner = OWNER;
  const repo = REPO;
  const tagName = `${version}`;
  const releaseTitle = releaseName || `Discourse Graph v${version}`;
  const isPrerelease = !isExternalRelease(version);

  const releaseTempDir = path.join(os.tmpdir(), "temp-obsidian-release-assets");

  try {
    if (fs.existsSync(releaseTempDir)) {
      fs.rmSync(releaseTempDir, { recursive: true });
    }

    fs.mkdirSync(releaseTempDir, { recursive: true });

    const buildDir = path.join(path.resolve("."), "dist");
    copyBuildFiles(buildDir, releaseTempDir);

    const obsidianDir = path.resolve(".");
    const manifestSrc = path.join(obsidianDir, "manifest.json");
    const manifestDest = path.join(releaseTempDir, "manifest.json");
    fs.copyFileSync(manifestSrc, manifestDest);
    updateManifest(releaseTempDir, version);

    const release = await octokit.request(
      "POST /repos/{owner}/{repo}/releases",
      {
        owner,
        repo,
        tag_name: tagName,
        name: releaseTitle,
        prerelease: isPrerelease,
        generate_release_notes: true,
      },
    );

    if (!release.data.upload_url) {
      throw new Error("Failed to get upload URL from release response");
    }

    for (const file of REQUIRED_BUILD_FILES) {
      const filePath = path.join(releaseTempDir, file);
      if (!fs.existsSync(filePath)) continue;

      const contentType =
        {
          ".js": "application/javascript",
          ".json": "application/json",
          ".css": "text/css",
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
  } finally {
    if (fs.existsSync(releaseTempDir)) {
      fs.rmSync(releaseTempDir, { recursive: true });
    }
  }
};

const publish = async (config: PublishConfig): Promise<void> => {
  const { version, releaseName } = config;
  const obsidianDir = path.resolve(".");
  const buildDir = path.join(obsidianDir, "dist");
  const tempDir = path.join(os.tmpdir(), "temp-obsidian-publish");

  try {
    const isExternal = isExternalRelease(version);
    const releaseType = isExternal ? "external" : "internal";
    log(`Publishing Obsidian plugin v${version} (${releaseType} release)`);

    await buildPlugin(obsidianDir);

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }

    copyDirectory({ src: obsidianDir, dest: tempDir, baseDir: obsidianDir });
    copyBuildFiles(buildDir, tempDir);

    if (isExternal) {
      updateManifest(tempDir, version);
      await updateMainBranch(tempDir, version);
    } else {
      log("Skipping main branch update for internal or pre-release");
    }

    await createGithubRelease({
      version,
      releaseName,
    });

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
