import type { Page } from "@playwright/test";
import {
  CREATE_NODE_COMMAND_ID,
  CREATE_NODE_PALETTE_LABEL,
  E2E_TIMEOUT,
  PLUGIN_ID,
} from "../constants";

export const E2E_SCRATCH_FILE = "e2e-scratch.md";
const LEGACY_SCRATCH_PREFIX = "scratch-e2e-";

export const executeCommand = async (
  page: Page,
  commandId: string = CREATE_NODE_COMMAND_ID,
): Promise<void> => {
  /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  await page.evaluate(
    ({ pluginId, id }) => {
      // @ts-expect-error - Obsidian's global `app` is available at runtime
      app.commands.executeCommandById(`${pluginId}:${id}`);
    },
    { pluginId: PLUGIN_ID, id: commandId },
  );
  /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
};

/**
 * Execute a command via the command palette UI.
 * Use this when testing the palette interaction itself.
 */
export const executeCommandViaPalette = async (
  page: Page,
  commandLabel: string = CREATE_NODE_PALETTE_LABEL,
): Promise<void> => {
  await page.keyboard.press("Meta+p");
  await page.waitForSelector(".prompt-input", { timeout: E2E_TIMEOUT });

  await page.keyboard.type(commandLabel, { delay: 30 });
  await page.waitForSelector(".suggestion-item", { timeout: E2E_TIMEOUT });

  await page.keyboard.press("Enter");
  await page.waitForSelector(".prompt-container", {
    state: "hidden",
    timeout: E2E_TIMEOUT,
  });
};

/**
 * Remove e2e scratch files from the vault (including legacy scratch-e2e-* files).
 */
export const cleanupE2eScratchFiles = async (page: Page): Promise<void> => {
  /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
  await page.evaluate(
    async ({ scratchPath, legacyPrefix }) => {
      // @ts-expect-error - Obsidian's global `app` is available at runtime
      const vault = app.vault;
      const files = vault
        .getMarkdownFiles()
        .filter(
          (f: { path: string; basename: string }) =>
            f.path === scratchPath || f.basename.startsWith(legacyPrefix),
        );
      for (const file of files) {
        await vault.delete(file);
      }
    },
    { scratchPath: E2E_SCRATCH_FILE, legacyPrefix: LEGACY_SCRATCH_PREFIX },
  );
  /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
};
