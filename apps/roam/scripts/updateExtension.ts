import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";  // for random dir names

// A small helper that runs shell commands safely.
function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf-8",
    ...options,
  });

  if (result.error) {
    throw new Error(`Error spawning command '${command}': ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Command '${command}' failed with exit code ${result.status}:\n${result.stderr}`);
  }

  return result.stdout.trim();
}

async function updateExtensionFile() {
  try {
    // 1. Validate we have the GITHUB_TOKEN in the environment
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error("GITHUB_TOKEN not found in environment variables. Aborting.");
    }

    // 2. Get the commit hash
    const commitHash = runCommand("git", ["rev-parse", "HEAD"]);
    console.log(`Current commit hash: ${commitHash}`);

    // 3. Create a random directory name to avoid collisions
    const randomSuffix = crypto.randomBytes(4).toString("hex");
    const tempDir = `temp_roam_depot_${randomSuffix}`;

    // 4. Clone the roam-depot repository using spawnSync
    //    * We do not log the token; avoid printing it to console.
    runCommand("git", [
      "clone",
      `https://x-access-token:${githubToken}@github.com/DiscourseGraphs/roam-depot.git`,
      tempDir,
    ]);

    // 5. Parse the content of the target file and update
    const filePath = path.join(tempDir, "extension/DiscourseGraphs/discoursegraph.json");
    const content = JSON.parse(fs.readFileSync(filePath, "utf8"));

    content.source_commit = commitHash;

    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), { encoding: "utf8" });

    // 6. Create a new branch, commit, and push changes. Each step is invoked in a controlled manner.
    //    * We never echo the token; no direct string interpolation in logs.
    runCommand("git", ["checkout", "-b", "update-source-commit"], { cwd: tempDir });
    runCommand("git", ["add", "."], { cwd: tempDir });
    runCommand("git", ["commit", "-m", `Update source_commit to ${commitHash}`], {
      cwd: tempDir,
    });
    runCommand("git", [
      "remote",
      "set-url",
      "origin",
      `https://x-access-token:${githubToken}@github.com/DiscourseGraphs/roam-depot.git`,
    ], {
      cwd: tempDir,
    });
    runCommand("git", ["push", "origin", "update-source-commit"], { cwd: tempDir });

    // 7. Clean up the temporary folder
    //    * Because the process succeeded, remove the tempDir.
    //      (You could also do this in a finally block if you want to clean up on error as well.)
    fs.rmSync(tempDir, { recursive: true, force: true });

    console.log("Successfully created PR with updated source_commit");
  } catch (error) {
    console.error("Failed to update extension:", error);
    throw error;
  }
}

async function main() {
  try {
    await updateExtensionFile();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default updateExtensionFile;
