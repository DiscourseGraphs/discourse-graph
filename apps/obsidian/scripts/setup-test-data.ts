#!/usr/bin/env tsx

import { promises as fs } from "fs";
import * as path from "path";

const VAULT_PATH = "/Users/trang.doan/Documents/Trang Doan";
const TEST_FOLDER = "test-bulk-import";
const SOURCE_DIR = "/Users/trang.doan/Downloads/notes-hugo/discourse-graph";

async function setupTestData() {
  const testFolderPath = path.join(VAULT_PATH, TEST_FOLDER);

  console.log("🧪 Setting up bulk import test data...");

  try {
    // Remove existing test folder if it exists
    try {
      await fs.access(testFolderPath);
      console.log("📁 Removing existing test folder...");
      await fs.rm(testFolderPath, { recursive: true, force: true });
    } catch (error) {
      // Folder doesn't exist, which is fine
    }

    // Check if source directory exists
    try {
      await fs.access(SOURCE_DIR);
      console.log("✅ Source directory found");
    } catch (error) {
      console.error(`❌ Source directory not found: ${SOURCE_DIR}`);
      process.exit(1);
    }

    // Show source directory structure and counts
    console.log("📊 Analyzing source directory...");
    await showDirectoryStats(SOURCE_DIR);

    // Create test folder
    console.log("📁 Creating test folder...");
    await fs.mkdir(testFolderPath, { recursive: true });

    // Copy files from source to test folder
    console.log("📄 Copying test files...");
    const fileCount = await copyDirectoryRecursive(SOURCE_DIR, testFolderPath);

    console.log(`🎉 Successfully created test folder with ${fileCount} files!`);
    console.log(`📍 Location: ${testFolderPath}`);
  } catch (error) {
    console.error("❌ Error setting up test data:", error);
    process.exit(1);
  }
}

async function copyDirectoryRecursive(
  source: string,
  target: string,
): Promise<number> {
  let fileCount = 0;

  const copyRecursive = async (src: string, dest: string): Promise<void> => {
    const items = await fs.readdir(src, { withFileTypes: true });

    for (const item of items) {
      const srcPath = path.join(src, item.name);
      const destPath = path.join(dest, item.name);

      if (item.isDirectory()) {
        console.log(`📁 Creating folder: ${path.relative(target, destPath)}`);
        await fs.mkdir(destPath, { recursive: true });
        await copyRecursive(srcPath, destPath);
      } else if (
        item.isFile() &&
        (item.name.endsWith(".md") || item.name.endsWith(".txt"))
      ) {
        // Only copy markdown and text files
        console.log(`📄 Copying: ${path.relative(target, destPath)}`);
        await fs.copyFile(srcPath, destPath);
        fileCount++;
      }
    }
  };

  await copyRecursive(source, target);
  return fileCount;
}

async function showDirectoryStats(
  dir: string,
  level: number = 0,
): Promise<void> {
  const indent = "  ".repeat(level);
  const items = await fs.readdir(dir, { withFileTypes: true });

  let fileCount = 0;
  let dirCount = 0;

  for (const item of items) {
    if (item.isDirectory()) {
      dirCount++;
    } else if (
      item.isFile() &&
      (item.name.endsWith(".md") || item.name.endsWith(".txt"))
    ) {
      fileCount++;
    }
  }

  console.log(
    `${indent}📁 ${path.basename(dir)}: ${fileCount} files, ${dirCount} subdirectories`,
  );

  // Recursively show subdirectories (but limit depth to avoid clutter)
  if (level < 2) {
    for (const item of items) {
      if (item.isDirectory()) {
        await showDirectoryStats(path.join(dir, item.name), level + 1);
      }
    }
  }
}

// Run the script
if (require.main === module) {
  setupTestData().catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });
}
