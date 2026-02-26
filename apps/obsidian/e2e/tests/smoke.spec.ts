import { test, expect, type Browser, type Page } from "@playwright/test";
import path from "path";
import type { ChildProcess } from "child_process";
import { createTestVault, cleanTestVault, launchObsidian } from "../helpers/obsidian-setup";

const VAULT_PATH = path.join(__dirname, "..", "test-vault-3");
const PLUGIN_ID = "@discourse-graph/obsidian";

let browser: Browser;
let page: Page;
let obsidianProcess: ChildProcess;

test.beforeAll(async () => {
  createTestVault(VAULT_PATH);
  const launched = await launchObsidian(VAULT_PATH);
  browser = launched.browser;
  page = launched.page;
  obsidianProcess = launched.obsidianProcess;
});

test.afterAll(async () => {
  if (browser) {
    await browser.close();
  }
  if (obsidianProcess) {
    obsidianProcess.kill();
  }
  cleanTestVault(VAULT_PATH);
});

test("Plugin loads in Obsidian", async () => {
  // Wait a bit for plugins to fully initialize
  await page.waitForTimeout(5_000);

  // Check that the plugin is loaded via Obsidian's internal API
  const pluginLoaded = await page.evaluate((pluginId) => {
    // @ts-expect-error - Obsidian's global `app` is available at runtime
    const plugins = app?.plugins?.plugins;
    return plugins ? pluginId in plugins : false;
  }, PLUGIN_ID);

  // Take a screenshot for visual verification
  await page.screenshot({ path: path.join(__dirname, "..", "test-results", "plugin-loaded.png") });

  expect(pluginLoaded).toBe(true);
});

test("Create a discourse node via command palette", async () => {
  const testTitle = `What is discourse graph testing ${Date.now()}`;

  // Ensure we have an active editor (the "Create discourse node" command requires editorCallback).
  // Create a scratch file with a unique name, or open it if it already exists.
  await page.evaluate(async () => {
    // @ts-expect-error - Obsidian's global `app` is available at runtime
    const vault = app.vault;
    const fileName = `scratch-e2e-${Date.now()}.md`;
    const file = await vault.create(fileName, "");
    // @ts-expect-error - Obsidian's global `app` is available at runtime
    await app.workspace.openLinkText(file.path, "", false);
  });
  await page.waitForTimeout(1_000);

  // Open the command palette with Cmd+P
  await page.keyboard.press("Meta+p");
  await page.waitForTimeout(500);

  // Type the command name to search for it
  await page.keyboard.type("Discourse Graph: Create discourse node", { delay: 30 });
  await page.waitForTimeout(500);

  // Press Enter to execute the command
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1_000);

  // The "Create discourse node" modal should now be open.
  // Wait for the modal to appear
  await page.waitForSelector(".modal-container", { timeout: 5_000 });

  // Select "Question" from the node type <select> dropdown
  const nodeTypeSelect = page.locator(".modal-container select").first();
  await nodeTypeSelect.selectOption({ label: "Question" });
  await page.waitForTimeout(300);

  // Fill the Content <input> field
  const contentInput = page.locator(".modal-container input[type='text']").first();
  await contentInput.click();
  await contentInput.fill(testTitle);
  await page.waitForTimeout(300);

  // Click the Confirm button (has class "mod-cta")
  await page.locator(".modal-container button.mod-cta").click();
  await page.waitForTimeout(2_000);

  // Verify the file was created using Obsidian's vault API
  const fileExists = await page.evaluate((title) => {
    // @ts-expect-error - Obsidian's global `app` is available at runtime
    const files = app?.vault?.getMarkdownFiles() || [];
    return files.some((f: { basename: string }) =>
      f.basename.includes(title) || f.basename.includes("QUE -")
    );
  }, testTitle);

  // Take a screenshot for visual verification
  await page.screenshot({ path: path.join(__dirname, "..", "test-results", "node-created.png") });

  expect(fileExists).toBe(true);

  // Verify the file content includes the nodeTypeId frontmatter
  const fileContent = await page.evaluate(() => {
    // @ts-expect-error - Obsidian's global `app` is available at runtime
    const files = app?.vault?.getMarkdownFiles() || [];
    const queFile = files.find((f: { basename: string }) =>
      f.basename.includes("QUE -")
    );
    if (!queFile) return null;
    // @ts-expect-error - Obsidian's global `app` is available at runtime
    return app.vault.read(queFile);
  });

  if (fileContent) {
    expect(fileContent).toContain("nodeTypeId");
  }
});
