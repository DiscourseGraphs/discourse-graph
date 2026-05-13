import path from "path";
import fs from "fs";
import type { Page } from "@playwright/test";

const TEST_RESULTS_DIR = path.join(__dirname, "..", "test-results");

/**
 * Capture a step-based screenshot organized by test name.
 * Saves to: test-results/<testName>/<stepName>.png
 */
export const captureStep = async (
  page: Page,
  testName: string,
  stepName: string,
): Promise<string> => {
  const dir = path.join(TEST_RESULTS_DIR, testName);
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${stepName}.png`);
  await page.screenshot({ path: filePath });
  return filePath;
};
