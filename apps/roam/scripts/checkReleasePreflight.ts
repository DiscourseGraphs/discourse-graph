import fs from "node:fs";
import path from "node:path";
import { checkChangelogSection } from "./releasePreflight";

const PACKAGE_PATH = "package.json";
const CHANGELOG_PATH = "CHANGELOG.md";

const getPackageVersion = (packageContents: string): string => {
  const packageJson: unknown = JSON.parse(packageContents);
  if (
    !packageJson ||
    typeof packageJson !== "object" ||
    !("version" in packageJson) ||
    typeof packageJson.version !== "string" ||
    !packageJson.version.trim()
  ) {
    throw new Error(`No version found in apps/roam/${PACKAGE_PATH}.`);
  }

  return packageJson.version.trim();
};

const escapeWorkflowCommand = (value: string): string =>
  value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

const failPreflight = (message: string): never => {
  console.error(
    `::error title=Roam release changelog preflight failed::${escapeWorkflowCommand(message)}`,
  );
  process.exit(1);
};

const packageContents = fs.readFileSync(
  path.resolve(process.cwd(), PACKAGE_PATH),
  "utf8",
);
const changelog = fs.readFileSync(
  path.resolve(process.cwd(), CHANGELOG_PATH),
  "utf8",
);
const version = getPackageVersion(packageContents);
const result = checkChangelogSection({ changelog, version });

if (result.status === "missing") {
  failPreflight(
    `Add a non-empty "## [${version}]" section to apps/roam/CHANGELOG.md, merge it to main, and rerun the workflow from main.`,
  );
}

if (result.status === "empty") {
  failPreflight(
    `Add release notes beneath the "## [${version}]" section in apps/roam/CHANGELOG.md, merge them to main, and rerun the workflow from main.`,
  );
}

console.log(`Changelog contains release notes for Roam ${version}.`);
