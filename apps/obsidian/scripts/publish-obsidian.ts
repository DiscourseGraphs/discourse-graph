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

const TARGET_REPO = "DiscourseGraphs/discourse-graph-obsidian";
const OWNER = "DiscourseGraphs";
const REPO = "discourse-graph-obsidian";

const log = (message: string): void => {
  console.log(`[Obsidian Publisher] ${message}`);
};

const getEnvVar = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value || "";
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

  // Internal releases are pre-release by default
  if (!args.includes("--stable")) {
    config.isPrerelease = !isExternalRelease(config.version);
  }

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
  --create-release, -r      Create a GitHub release
  --target-repo <repo>      Target repository
  --stable                 Mark as stable release (defaults to pre-release if not specified)
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
  tsx scripts/publish-obsidian.ts --version 0.1.0-alpha-canvas --release-name "Canvas Integration Feature" --create-release
  
  # Beta release with feature description
  tsx scripts/publish-obsidian.ts --version 1.0.0-beta.1 --release-name "Beta: New Graph View" --create-release
  
  # Stable release (uses default name)
  tsx scripts/publish-obsidian.ts --version 1.0.0 --stable --create-release
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

  try {
    const { data: ref } = await octokit.request(
      "GET /repos/{owner}/{repo}/git/refs/{ref}",
      {
        owner: OWNER,
        repo: REPO,
        ref: "heads/main",
      },
    );

    if (!ref?.object?.sha) {
      throw new Error("Failed to get main branch reference");
    }
    const currentSha = ref.object.sha;

    const { data: currentCommit } = await octokit.request(
      "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
      {
        owner: OWNER,
        repo: REPO,
        commit_sha: currentSha,
      },
    );

    if (!currentCommit?.tree?.sha) {
      throw new Error("Failed to get current commit tree");
    }
    const currentTreeSha = currentCommit.tree.sha;

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

    const allFiles = getAllFiles(tempDir);
    log(`Found ${allFiles.length} files to update`);

    const blobPromises = allFiles.map(async (filePath) => {
      const fullPath = path.join(tempDir, filePath);
      const content = fs.readFileSync(fullPath);

      const { data: blob } = await octokit.request(
        "POST /repos/{owner}/{repo}/git/blobs",
        {
          owner: OWNER,
          repo: REPO,
          content: content.toString("base64"),
          encoding: "base64",
        },
      );

      if (!blob?.sha) {
        throw new Error(`Failed to create blob for ${filePath}`);
      }

      return {
        path: filePath.replace(/\\/g, "/"), // Normalize path separators for GitHub
        sha: blob.sha,
      };
    });

    const blobs = await Promise.all(blobPromises);

    const { data: newTree } = await octokit.request(
      "POST /repos/{owner}/{repo}/git/trees",
      {
        owner: OWNER,
        repo: REPO,
        base_tree: currentTreeSha,
        tree: blobs.map((blob) => ({
          path: blob.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blob.sha,
        })),
      },
    );

    if (!newTree?.sha) {
      throw new Error("Failed to create new tree");
    }

    const { data: newCommit } = await octokit.request(
      "POST /repos/{owner}/{repo}/git/commits",
      {
        owner: OWNER,
        repo: REPO,
        message: `Release v${version}`,
        tree: newTree.sha,
        parents: [currentSha],
      },
    );

    if (!newCommit?.sha) {
      throw new Error("Failed to create new commit");
    }

    await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
      owner: OWNER,
      repo: REPO,
      ref: "heads/main",
      sha: newCommit.sha,
    });

    log(`Successfully updated main branch with commit: ${newCommit.sha}`);
    log(`Updated ${blobs.length} files`);
  } catch (error) {
    log(`Failed to update main branch: ${error}`);
    throw error;
  }
};

const createGithubRelease = async ({
  tempDir,
  version,
  isPrerelease,
  releaseName,
}: {
  tempDir: string;
  version: string;
  isPrerelease: boolean;
  releaseName?: string;
}): Promise<void> => {
  log("Creating GitHub release...");

  const token = getEnvVar("OBSIDIAN_PLUGIN_REPO_TOKEN");
  const octokit = new Octokit({ auth: token });
  const owner = OWNER;
  const repo = REPO;
  const tagName = `v${version}`;
  const releaseTitle = releaseName || `Discourse Graph v${version}`;

  const release = await octokit.request("POST /repos/{owner}/{repo}/releases", {
    owner,
    repo,
    tag_name: tagName,
    name: releaseTitle,
    prerelease: isPrerelease,
    generate_release_notes: true,
  });

  if (!release.data.upload_url) {
    throw new Error("Failed to get upload URL from release response");
  }

  for (const file of REQUIRED_BUILD_FILES) {
    const filePath = path.join(tempDir, file);
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
};

const publish = async (config: PublishConfig): Promise<void> => {
  const { version, createRelease, isPrerelease } = config;
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

    copyDirectory(obsidianDir, tempDir, obsidianDir);
    copyBuildFiles(buildDir, tempDir);

    if (isExternal && !isPrerelease) {
      updateManifest(tempDir, version);
      await updateMainBranch(tempDir, version);
    } else {
      log("Skipping main branch update for internal or pre-release");
    }

    if (createRelease) {
      const releaseTempDir = path.join(
        os.tmpdir(),
        "temp-obsidian-release-assets",
      );

      if (fs.existsSync(releaseTempDir)) {
        fs.rmSync(releaseTempDir, { recursive: true });
      }

      fs.mkdirSync(releaseTempDir, { recursive: true });
      copyBuildFiles(buildDir, releaseTempDir);

      const manifestSrc = path.join(obsidianDir, "manifest.json");
      const manifestDest = path.join(releaseTempDir, "manifest.json");
      fs.copyFileSync(manifestSrc, manifestDest);
      updateManifest(releaseTempDir, version);

      await createGithubRelease({
        tempDir: releaseTempDir,
        version,
        isPrerelease,
        releaseName: config.releaseName,
      });

      fs.rmSync(releaseTempDir, { recursive: true });
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
