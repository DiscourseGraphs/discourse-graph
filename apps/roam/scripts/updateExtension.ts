import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const updateExtensionFile = async () => {
  try {
    // On PR merge to main - this script will be triggered by GitHub Actions
    // after a successful merge to main branch

    // Get the commit hash
    const commitHash = execSync("git rev-parse HEAD").toString().trim();
    console.log(`Current commit hash: ${commitHash}`);

    // Clone the roam-depot repository
    // https://github.com/DiscourseGraphs/roam-depot.git
    const tempDir = "temp_roam_depot";
    execSync(`git clone https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/DiscourseGraphs/roam-depot.git ${tempDir}`);
    
    // Update extension/DiscourseGraphs/discoursegraph.json
    const filePath = path.join(tempDir, "extension/DiscourseGraphs/discoursegraph.json");
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Update the field "source_commit" with the new commit hash
    content.source_commit = commitHash;
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));

    // Create a PR to the repo
    execSync(`
      cd ${tempDir} &&
      git checkout -b update-source-commit &&
      git add . &&
      git commit -m "Update source_commit to ${commitHash}" &&
      git remote set-url origin https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/DiscourseGraphs/roam-depot.git &&
      git push origin update-source-commit &&
      cd .. &&
      rm -rf ${tempDir}
    `);    

    console.log("Successfully created PR with updated source_commit");
  } catch (error) {
    console.error("Failed to update extension:", error);
    throw error;
  }
};

const main = async () => {
  try {
    await updateExtensionFile();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

export default updateExtensionFile;