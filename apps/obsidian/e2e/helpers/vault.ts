import type { Page } from "@playwright/test";

/**
 * Find markdown files whose basename starts with the given prefix.
 * Returns an array of basenames.
 */
export const findFilesByPrefix = async (
  page: Page,
  prefix: string,
): Promise<string[]> => {
  /* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
  return page.evaluate((pfx) => {
    // @ts-expect-error - Obsidian's global `app` is available at runtime
    const files = app?.vault?.getMarkdownFiles() || [];
    return files
      .filter((f: { basename: string }) => f.basename.startsWith(pfx))
      .map((f: { basename: string }) => f.basename);
  }, prefix);
  /* eslint-enable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
};

/**
 * Read the text content of a markdown file by its basename.
 * Returns null if the file is not found.
 */
export const readFileContent = async (
  page: Page,
  basename: string,
): Promise<string | null> => {
  /* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await */
  return page.evaluate(async (name) => {
    // @ts-expect-error - Obsidian's global `app` is available at runtime
    const files = app?.vault?.getMarkdownFiles() || [];
    const file = files.find((f: { basename: string }) => f.basename === name);
    if (!file) return null;
    // @ts-expect-error - Obsidian's global `app` is available at runtime
    return app.vault.read(file);
  }, basename);
  /* eslint-enable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await */
};

/**
 * Check whether a plugin is loaded in Obsidian's plugin registry.
 */
export const isPluginLoaded = async (
  page: Page,
  pluginId: string,
): Promise<boolean> => {
  /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
  return page.evaluate((id) => {
    // @ts-expect-error - Obsidian's global `app` is available at runtime
    const plugins = app?.plugins?.plugins;
    return plugins ? id in plugins : false;
  }, pluginId);
  /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
};

/**
 * Wait until a plugin is present in Obsidian's plugin registry.
 * Replaces waitForTimeout() calls that blindly wait for plugin initialization.
 */
export const waitForPluginLoaded = async (
  page: Page,
  pluginId: string,
  timeout = 30_000,
): Promise<void> => {
  /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
  await page.waitForFunction(
    (id) => {
      // @ts-expect-error - Obsidian's global `app` is available at runtime
      const plugins = app?.plugins?.plugins;
      return plugins ? id in plugins : false;
    },
    pluginId,
    { timeout },
  );
  /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
};

/**
 * Get all markdown file basenames in the vault.
 */
export const getMarkdownFiles = async (page: Page): Promise<string[]> => {
  /* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
  return page.evaluate(() => {
    // @ts-expect-error - Obsidian's global `app` is available at runtime
    const files = app?.vault?.getMarkdownFiles() || [];
    return files.map((f: { basename: string }) => f.basename);
  });
  /* eslint-enable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
};
