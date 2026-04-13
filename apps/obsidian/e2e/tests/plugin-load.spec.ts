import { test, expect, type Browser, type Page } from "@playwright/test";
import path from "path";
import type { ChildProcess } from "child_process";
import {
  ensureVaultWithPlugin,
  cleanTestVault,
  launchObsidian,
  restoreObsidianConfig,
  resolveVaultPath,
  isCustomVault,
} from "../helpers/obsidian-setup";
import { isPluginLoaded, waitForPluginLoaded } from "../helpers/vault";
import { captureStep } from "../helpers/screenshots";

const VAULT_PATH = resolveVaultPath(
  path.join(__dirname, "..", "test-vault-plugin-load"),
);
const PLUGIN_ID = "@discourse-graph/obsidian";

let browser: Browser;
let page: Page;
let obsidianProcess: ChildProcess;
let originalObsidianConfig: string | undefined;

test.beforeAll(async () => {
  ensureVaultWithPlugin(VAULT_PATH);
  const launched = await launchObsidian(VAULT_PATH);
  browser = launched.browser;
  page = launched.page;
  obsidianProcess = launched.obsidianProcess;
  originalObsidianConfig = launched.originalObsidianConfig;
});

test.afterAll(async () => {
  if (browser) await browser.close();
  if (obsidianProcess) obsidianProcess.kill();
  if (originalObsidianConfig) restoreObsidianConfig(originalObsidianConfig);
  if (!isCustomVault()) cleanTestVault(VAULT_PATH);
});

test("Plugin loads in Obsidian", async () => {
  await waitForPluginLoaded(page, PLUGIN_ID);

  const pluginLoaded = await isPluginLoaded(page, PLUGIN_ID);

  await captureStep(page, "plugin-load", "01-plugin-loaded");

  expect(pluginLoaded).toBe(true);
});
