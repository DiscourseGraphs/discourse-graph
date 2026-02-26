import { test, expect, type Browser, type Page } from "@playwright/test";
import path from "path";
import type { ChildProcess } from "child_process";
import {
  createTestVault,
  cleanTestVault,
  launchObsidian,
} from "../helpers/obsidian-setup";
import {
  ensureActiveEditor,
  executeCommandViaPalette,
} from "../helpers/commands";
import {
  isPluginLoaded,
  findFilesByPrefix,
  readFileContent,
} from "../helpers/vault";
import {
  waitForModal,
  selectNodeType,
  fillNodeContent,
  confirmModal,
} from "../helpers/modal";
import { captureStep } from "../helpers/screenshots";

const VAULT_PATH = path.join(__dirname, "..", "test-vault-smoke");
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
  await page.waitForTimeout(5_000);

  const pluginLoaded = await isPluginLoaded(page, PLUGIN_ID);
  await captureStep(page, "smoke", "01-plugin-loaded");

  expect(pluginLoaded).toBe(true);
});

test("Create a discourse node via command palette", async () => {
  await ensureActiveEditor(page);

  await executeCommandViaPalette(
    page,
    "Discourse Graph: Create discourse node",
  );

  await waitForModal(page);
  await captureStep(page, "smoke", "02-modal-open");

  await selectNodeType(page, "Question");
  await fillNodeContent(page, `What is discourse graph testing ${Date.now()}`);
  await captureStep(page, "smoke", "03-modal-filled");

  await confirmModal(page);
  await captureStep(page, "smoke", "04-node-created");

  const files = await findFilesByPrefix(page, "QUE -");
  expect(files.length).toBeGreaterThan(0);

  const content = await readFileContent(page, files[0]!);
  if (content) {
    expect(content).toContain("nodeTypeId");
  }
});
