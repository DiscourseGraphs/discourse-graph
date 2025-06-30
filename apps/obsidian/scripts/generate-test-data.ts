#!/usr/bin/env tsx

import { promises as fs } from "fs";
import * as path from "path";

/**
 * Generates a set of markdown files that match the naming pattern
 * for each default discourse node type. Useful for stress-testing the
 * bulk-import feature without relying on external data sources.
 */

const VAULT_PATH = "/Users/trang.doan/Documents/Trang Doan";
const TEST_FOLDER = "test-bulk-import-generated";
const FILES_PER_TYPE = 300;

/** Minimal representation of the default node types. */
const DEFAULT_NODE_TYPES: { name: string; format: string }[] = [
  { name: "Question", format: "QUE - {content}" },
  { name: "Claim", format: "CLM - {content}" },
  { name: "Evidence", format: "EVD - {content}" },
];

async function main() {
  const targetDir = path.join(VAULT_PATH, TEST_FOLDER);

  console.log("🧪 Generating test files for bulk import…\n");

  // Clean existing folder if present
  try {
    await fs.rm(targetDir, { recursive: true, force: true });
    console.log("🧹 Removed existing test folder (if any)");
  } catch (_) {
    /* noop */
  }

  // Ensure target directory exists
  await fs.mkdir(targetDir, { recursive: true });
  console.log(`📁 Created test folder: ${targetDir}\n`);

  for (const nodeType of DEFAULT_NODE_TYPES) {
    console.log(`📄 Creating ${FILES_PER_TYPE} ${nodeType.name} files…`);

    for (let i = 1; i <= FILES_PER_TYPE; i++) {
      const contentPlaceholder = `${nodeType.name} ${String(i).padStart(3, "0")}`;
      const title = nodeType.format.replace("{content}", contentPlaceholder);
      const filename = `${title}.md`;
      const filePath = path.join(targetDir, filename);

      const body = `# ${title}\n\nAutomatically generated for bulk-import testing.`;
      await fs.writeFile(filePath, body, "utf8");
    }

    console.log(`   ✅ Done (${FILES_PER_TYPE} files)`);
  }

  console.log("\n🎉 Test file generation complete!");
  console.log(`📍 Location: ${targetDir}\n`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("💥 Generation failed:", err);
    process.exit(1);
  });
}
