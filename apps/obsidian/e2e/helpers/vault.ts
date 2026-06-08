import type { Page } from "@playwright/test";

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

export const waitForPluginLoaded = async ({
  page,
  pluginId,
  timeout = 30_000,
}: {
  page: Page;
  pluginId: string;
  timeout?: number;
}): Promise<void> => {
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
