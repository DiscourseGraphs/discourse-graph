import type { Page } from "@playwright/test";

/**
 * Execute a command via Obsidian's internal command API (fast, reliable).
 * Use this for most test scenarios.
 */
export const executeCommand = async (page: Page, commandId: string): Promise<void> => {
  await page.evaluate((id) => {
    // @ts-expect-error - Obsidian's global `app` is available at runtime
    app.commands.executeCommandById(`@discourse-graph/obsidian:${id}`);
  }, commandId);
  await page.waitForTimeout(500);
};

/**
 * Execute a command via the command palette UI.
 * Use this when testing the palette interaction itself.
 */
export const executeCommandViaPalette = async (page: Page, commandLabel: string): Promise<void> => {
  await page.keyboard.press("Meta+p");
  await page.waitForTimeout(500);

  await page.keyboard.type(commandLabel, { delay: 30 });
  await page.waitForTimeout(500);

  await page.keyboard.press("Enter");
  await page.waitForTimeout(1_000);
};

/**
 * Ensure an active editor exists by creating and opening a scratch file.
 * Required before running editorCallback commands like "Create discourse node".
 */
export const ensureActiveEditor = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    // @ts-expect-error - Obsidian's global `app` is available at runtime
    const vault = app.vault;
    const fileName = `scratch-e2e-${Date.now()}.md`;
    const file = await vault.create(fileName, "");
    // @ts-expect-error - Obsidian's global `app` is available at runtime
    await app.workspace.openLinkText(file.path, "", false);
  });
  await page.waitForTimeout(1_000);
};
