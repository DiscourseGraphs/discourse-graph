import { test as base } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import {
  DEFAULT_TEST_VAULT,
  createTestVault,
  ensureVaultWithPlugin,
  launchObsidian,
  restoreObsidianConfig,
  resolveVaultPath,
  isCustomVault,
  killObsidianOnDebugPort,
  cleanTestVault,
} from "../helpers/obsidian-setup";
import { cleanupE2eScratchFiles } from "../helpers/commands";

type ObsidianWorker = {
  browser: Browser;
  page: Page;
  vaultPath: string;
  originalObsidianConfig?: string;
};

export const test = base.extend<object, { obsidian: ObsidianWorker }>({
  obsidian: [
    async ({}, use) => {
      const vaultPath = resolveVaultPath(DEFAULT_TEST_VAULT);
      if (isCustomVault()) {
        ensureVaultWithPlugin(vaultPath);
      } else {
        createTestVault(vaultPath);
      }

      const launched = await launchObsidian(vaultPath);

      await use({
        browser: launched.browser,
        page: launched.page,
        vaultPath,
        originalObsidianConfig: launched.originalObsidianConfig,
      });

      await cleanupE2eScratchFiles(launched.page).catch(() => {
        // Vault may already be unavailable if Obsidian shut down early
      });
      await launched.browser.close();
      await killObsidianOnDebugPort();
      if (launched.originalObsidianConfig) {
        restoreObsidianConfig(launched.originalObsidianConfig);
      }
      if (!isCustomVault()) {
        cleanTestVault(vaultPath);
      }
    },
    { scope: "worker" },
  ],
});

export { expect } from "@playwright/test";
