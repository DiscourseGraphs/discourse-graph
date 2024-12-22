import { put } from "@vercel/blob";
import fs, { readFileSync } from "fs";
import { join } from "path";

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const deploy = async () => {
  try {
    const resolvedWorkspace = "roam";
    if (!resolvedWorkspace) throw new Error("Workspace is required");

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new Error(
        "BLOB_READ_WRITE_TOKEN is required but not found in environment variables",
      );
    }

    const resolvedBranch =
      // 1. GitHub Actions environment variable for Pull Requests
      process.env.GITHUB_HEAD_REF ||
      // 2. GitHub Actions environment variable for pushes/tags
      process.env.GITHUB_REF_NAME ||
      // 3. Local Git branch resolution
      require("child_process")
        .execSync("git rev-parse --abbrev-ref HEAD")
        .toString()
        .trim() ||
      // 4. Final fallback
      "main";

    const distPath = join(process.cwd(), "dist");
    const files = [
      "extension.js",
      "extension.css",
      "package.json",
      "README.md",
      "CHANGELOG.md",
    ];

    for (const file of files) {
      const filePath = join(distPath, file);
      if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${file} - file does not exist`);
        continue;
      }

      const content = readFileSync(join(distPath, file));
      const pathname =
        resolvedBranch === "main"
          ? `releases/${resolvedWorkspace}/${file}`
          : `releases/${resolvedWorkspace}/${resolvedBranch}/${file}`;

      console.log(`Uploading ${file}...`);

      const blob = await put(pathname, content, {
        access: "public",
        addRandomSuffix: false,
        token,
      });

      console.log(`✅ Uploaded to ${blob.url}`);
    }

    console.log("Deploy completed successfully!");
    console.log(
      `https://discoursegraphs.com/releases/${resolvedWorkspace}/${resolvedBranch}`,
    );
  } catch (error) {
    console.error("Deploy failed:", error);
    process.exit(1);
  }
};

const main = async () => {
  try {
    await deploy();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

export default deploy;
