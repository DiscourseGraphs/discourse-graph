import type { Page } from "@playwright/test";

/**
 * Execute a command via Obsidian's internal command API (fast, reliable).
 * Use this for most test scenarios.
 */
export const executeCommand = async (
  page: Page,
  commandId: string,
): Promise<void> => {
  /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  await page.evaluate((id) => {
    // @ts-expect-error - Obsidian's global `app` is available at runtime
    app.commands.executeCommandById(`@discourse-graph/obsidian:${id}`);
  }, commandId);
  /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
};

/**
 * Execute a command via the command palette UI.
 * Use this when testing the palette interaction itself.
 */
export const executeCommandViaPalette = async (
  page: Page,
  commandLabel: string,
): Promise<void> => {
  await page.keyboard.press("Meta+p");
  await page.waitForSelector(".prompt-input", { timeout: 10_000 });

  await page.keyboard.type(commandLabel, { delay: 30 });
  await page.waitForSelector(".suggestion-item", { timeout: 10_000 });

  await page.keyboard.press("Enter");
  await page.waitForSelector(".prompt-container", {
    state: "hidden",
    timeout: 10_000,
  });
};

/**
 * Ensure an active editor exists by creating and opening a scratch file.
 * Required before running editorCallback commands like "Create discourse node".
 */
export const ensureActiveEditor = async (page: Page): Promise<void> => {
  /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
  await page.evaluate(async () => {
    // @ts-expect-error - Obsidian's global `app` is available at runtime
    const vault = app.vault;
    const fileName = `scratch-e2e-${Date.now()}.md`;
    const file = await vault.create(fileName, "");
    // @ts-expect-error - Obsidian's global `app` is available at runtime
    await app.workspace.openLinkText(file.path, "", false);
  });
  /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
  await page.waitForSelector(".cm-editor", { timeout: 10_000 });
};
