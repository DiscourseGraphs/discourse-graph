import { test, expect, type Browser, type Page } from "@playwright/test";
import path from "path";
import type { ChildProcess } from "child_process";
import {
  createTestVault,
  cleanTestVault,
  launchObsidian,
} from "../helpers/obsidian-setup";
import { isPluginLoaded } from "../helpers/vault";
import { captureStep } from "../helpers/screenshots";

const VAULT_PATH = path.join(__dirname, "..", "test-vault-plugin-load");
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

  await captureStep(page, "plugin-load", "01-plugin-loaded");

  expect(pluginLoaded).toBe(true);
});
