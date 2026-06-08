import { test, expect, type Browser, type Page } from "@playwright/test";
import path from "path";
import {
  ensureVaultWithPlugin,
  cleanTestVault,
  launchObsidian,
  restoreObsidianConfig,
  resolveVaultPath,
  isCustomVault,
  killObsidianOnDebugPort,
} from "../helpers/obsidian-setup";
import {
  ensureActiveEditor,
  executeCommandViaPalette,
} from "../helpers/commands";
import {
  findFilesByPrefix,
  readFileContent,
  waitForPluginLoaded,
} from "../helpers/vault";
import {
  waitForModal,
  selectNodeType,
  fillNodeContent,
  confirmModal,
} from "../helpers/modal";
import { captureStep } from "../helpers/screenshots";

const VAULT_PATH = resolveVaultPath(
  path.join(__dirname, "..", "test-vault-node-creation"),
);

let browser: Browser;
let page: Page;
let originalObsidianConfig: string | undefined;

test.beforeAll(async () => {
  ensureVaultWithPlugin(VAULT_PATH);
  const launched = await launchObsidian(VAULT_PATH);
  browser = launched.browser;
  page = launched.page;
  originalObsidianConfig = launched.originalObsidianConfig;

  // Wait for plugin to initialize (polls instead of blind sleep)
  await waitForPluginLoaded({
    page,
    pluginId: "@discourse-graph/obsidian",
  });
});

test.afterAll(async () => {
  if (browser) await browser.close();
  await killObsidianOnDebugPort();
  if (originalObsidianConfig) restoreObsidianConfig(originalObsidianConfig);
  if (!isCustomVault()) cleanTestVault(VAULT_PATH);
});

test("Create a Question node via command palette", async () => {
  await ensureActiveEditor(page);

  await executeCommandViaPalette(
    page,
    "Discourse Graph: Create discourse node",
  );

  await waitForModal(page);
  await captureStep({
    page,
    testName: "node-creation",
    stepName: "01-modal-open",
  });

  await selectNodeType(page, "Question");
  await fillNodeContent(page, `What is discourse graph testing ${Date.now()}`);
  await captureStep({
    page,
    testName: "node-creation",
    stepName: "02-modal-filled",
  });

  await confirmModal(page);
  await captureStep({
    page,
    testName: "node-creation",
    stepName: "03-node-created",
  });

  // Verify file was created with correct prefix
  const files = await findFilesByPrefix(page, "QUE -");
  expect(files.length).toBeGreaterThan(0);

  // Verify frontmatter contains nodeTypeId
  const content = await readFileContent(page, files[0]!);
  if (content) {
    expect(content).toContain("nodeTypeId");
  }
});
