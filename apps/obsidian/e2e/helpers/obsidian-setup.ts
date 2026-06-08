import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { spawn, execSync, type ChildProcess } from "child_process";
import { chromium, type Browser, type Page } from "@playwright/test";
import { PLUGIN_BUILD_FILES, PLUGIN_ID } from "../constants";

const DEFAULT_OBSIDIAN_APP_PATH =
  "/Applications/Obsidian.app/Contents/MacOS/Obsidian";

export const DEFAULT_TEST_VAULT = path.join(__dirname, "..", "test-vault");

const OBSIDIAN_CONFIG_PATH = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "obsidian",
  "obsidian.json",
);
export const DEBUG_PORT = 9222;
const CDP_HOST = "127.0.0.1";

const normalizeVaultPath = (vaultPath: string): string =>
  path.resolve(vaultPath);

/**
 * Resolve the Obsidian app executable path from OBSIDIAN_APP_PATH or the macOS default.
 */
export const resolveObsidianAppPath = (): string => {
  // eslint-disable-next-line turboPlugin/no-undeclared-env-vars -- local dev-only, not a turbo cache key
  const appPath = process.env.OBSIDIAN_APP_PATH ?? DEFAULT_OBSIDIAN_APP_PATH;
  if (!fs.existsSync(appPath)) {
    throw new Error(
      `Obsidian executable not found at ${appPath}. ` +
        `Set OBSIDIAN_APP_PATH in apps/obsidian/.env or install Obsidian.`,
    );
  }
  return appPath;
};

/**
 * Resolve the .app bundle path from OBSIDIAN_APP_PATH (macOS launch via `open`).
 */
const resolveObsidianAppBundle = (): string => {
  const appPath = resolveObsidianAppPath();
  const match = appPath.match(/^(.*\.app)/);
  return match?.[1] ?? "/Applications/Obsidian.app";
};

/**
 * Kill the Obsidian process holding the CDP debug port.
 * Obsidian's executable is a launcher that forks Electron; killing the
 * launcher alone leaves the child process running.
 */
export const killObsidianOnDebugPort = async (
  port = DEBUG_PORT,
): Promise<void> => {
  try {
    const pids = execSync(`lsof -ti tcp:${port}`, {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (pids) {
      execSync(`kill -9 ${pids.split("\n").join(" ")}`, { stdio: "ignore" });
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch {
    // No process on the port — that's fine
  }
};

/**
 * Returns the absolute vault path to use for tests.
 * Reads from OBSIDIAN_TEST_VAULT env var, or falls back to the provided default.
 */
const stripEnvQuotes = (value: string): string =>
  value.replace(/^["']|["']$/g, "");

export const resolveVaultPath = (defaultPath: string): string =>
  normalizeVaultPath(
    stripEnvQuotes(
      // eslint-disable-next-line turboPlugin/no-undeclared-env-vars -- local dev-only, not a turbo cache key
      process.env.OBSIDIAN_TEST_VAULT ?? defaultPath,
    ),
  );

/**
 * Whether we're using a custom vault (skip cleanup).
 */
export const isCustomVault = (): boolean =>
  // eslint-disable-next-line turboPlugin/no-undeclared-env-vars -- local dev-only, not a turbo cache key
  process.env.OBSIDIAN_TEST_VAULT !== undefined;

/**
 * Ensure a vault exists at vaultPath with the plugin installed.
 *
 * Safe to call on existing vaults — only creates directories and
 * copies plugin files without wiping existing vault content.
 * For fresh temp vaults, call cleanTestVault first.
 */
export const ensureVaultWithPlugin = (vaultPath: string): void => {
  const resolvedVaultPath = normalizeVaultPath(vaultPath);
  const obsidianDir = path.join(resolvedVaultPath, ".obsidian");
  const pluginDir = path.join(obsidianDir, "plugins", PLUGIN_ID);
  fs.mkdirSync(pluginDir, { recursive: true });

  // Ensure community-plugins.json includes our plugin
  const communityPluginsPath = path.join(obsidianDir, "community-plugins.json");
  let enabledPlugins: string[] = [];
  if (fs.existsSync(communityPluginsPath)) {
    enabledPlugins = JSON.parse(
      fs.readFileSync(communityPluginsPath, "utf-8"),
    ) as string[];
  }
  if (!enabledPlugins.includes(PLUGIN_ID)) {
    enabledPlugins.push(PLUGIN_ID);
    fs.writeFileSync(communityPluginsPath, JSON.stringify(enabledPlugins));
  }

  // Ensure app.json exists
  const appJsonPath = path.join(obsidianDir, "app.json");
  if (!fs.existsSync(appJsonPath)) {
    fs.writeFileSync(appJsonPath, JSON.stringify({ livePreview: true }));
  }

  // Copy built plugin files from dist/
  const distDir = path.join(__dirname, "..", "..", "dist");
  if (!fs.existsSync(distDir)) {
    throw new Error(
      `dist/ directory not found at ${distDir}. Run "pnpm build" first.`,
    );
  }

  for (const file of PLUGIN_BUILD_FILES) {
    const src = path.join(distDir, file);
    if (!fs.existsSync(src)) {
      throw new Error(
        `Missing build artifact ${file} at ${src}. Run "pnpm build" first.`,
      );
    }
    fs.copyFileSync(src, path.join(pluginDir, file));
  }
};

/**
 * Create a fresh temp vault (wipes existing content).
 * Only use this for auto-created temp vaults, not custom vaults.
 */
export const createTestVault = (vaultPath: string): void => {
  cleanTestVault(vaultPath);
  ensureVaultWithPlugin(vaultPath);
};

export const cleanTestVault = (vaultPath: string): void => {
  const resolvedVaultPath = normalizeVaultPath(vaultPath);
  if (fs.existsSync(resolvedVaultPath)) {
    fs.rmSync(resolvedVaultPath, { recursive: true, force: true });
  }
};

/**
 * Set the target vault as the active vault in Obsidian's config.
 *
 * Obsidian doesn't support a `--vault` CLI flag. Instead, it opens
 * whichever vault has `"open": true` in obsidian.json. We manipulate
 * that file before launch and restore it after tests.
 */
const setActiveVault = (vaultPath: string): string | undefined => {
  if (!fs.existsSync(OBSIDIAN_CONFIG_PATH)) return undefined;

  const resolvedVaultPath = normalizeVaultPath(vaultPath);
  const original = fs.readFileSync(OBSIDIAN_CONFIG_PATH, "utf-8");
  const config = JSON.parse(original) as {
    vaults: Record<string, { path: string; ts: number; open?: boolean }>;
  };

  let targetId: string | undefined;
  for (const [id, vault] of Object.entries(config.vaults)) {
    delete vault.open;
    if (normalizeVaultPath(vault.path) === resolvedVaultPath) {
      targetId = id;
      vault.path = resolvedVaultPath;
    }
  }

  if (!targetId) {
    targetId = crypto.randomBytes(8).toString("hex");
    config.vaults[targetId] = {
      path: resolvedVaultPath,
      ts: Date.now(),
    };
  }

  const targetVault = config.vaults[targetId]!;
  targetVault.open = true;
  targetVault.ts = Date.now();
  targetVault.path = resolvedVaultPath;

  fs.writeFileSync(OBSIDIAN_CONFIG_PATH, JSON.stringify(config));
  return original;
};

/**
 * Restore the original obsidian.json after tests.
 */
export const restoreObsidianConfig = (original: string): void => {
  fs.writeFileSync(OBSIDIAN_CONFIG_PATH, original);
};

/**
 * Verify Obsidian opened the expected vault directory.
 */
export const verifyActiveVault = async ({
  page,
  expectedPath,
}: {
  page: Page;
  expectedPath: string;
}): Promise<void> => {
  const resolvedExpectedPath = normalizeVaultPath(expectedPath);
  /* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access */
  const actualPath = await page.evaluate(() => {
    // @ts-expect-error - Obsidian's global `app` is available at runtime
    return app?.vault?.adapter?.basePath as string | undefined;
  });
  /* eslint-enable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access */

  const normalizedActualPath =
    actualPath === undefined ? undefined : normalizeVaultPath(actualPath);

  if (normalizedActualPath !== resolvedExpectedPath) {
    throw new Error(
      `Obsidian opened the wrong vault.\n` +
        `  Expected: ${resolvedExpectedPath}\n` +
        `  Actual:   ${normalizedActualPath ?? "(unknown)"}\n` +
        `Close any running Obsidian instance and ensure obsidian.json points at the test vault.`,
    );
  }
};

/**
 * Find the vault workspace page among all CDP pages.
 *
 * Obsidian opens multiple windows (dev console, main workspace).
 * We need the one that has the `.workspace` element.
 */
const findWorkspacePage = async (
  browser: Browser,
  timeout = 30_000,
): Promise<Page> => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        const hasWorkspace = await page
          .locator(".workspace")
          .first()
          .isVisible()
          .catch(() => false);
        if (hasWorkspace) return page;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `No page with .workspace found within ${timeout}ms. ` +
      `Available pages: ${browser
        .contexts()
        .flatMap((c) => c.pages().map((p) => p.url()))
        .join(", ")}`,
  );
};

/**
 * Launch Obsidian with remote debugging enabled, then connect via CDP.
 *
 * On macOS we use `open -na` so the forked Electron child inherits the debug
 * port reliably. Direct spawn of the MacOS/Obsidian binary is the launcher
 * stub and often fails readiness checks even when stderr prints "DevTools
 * listening".
 *
 * Obsidian CLI cannot replace this step — it launches a normal GUI instance
 * without `--remote-debugging-port`. Use CLI after launch for vault commands.
 */
const launchObsidianWithDebugPort = (): ChildProcess | null => {
  if (process.platform === "darwin") {
    const appBundle = resolveObsidianAppBundle();
    console.log(
      `[e2e] open -na ${appBundle} --args --remote-debugging-port=${DEBUG_PORT}`,
    );
    execSync(
      `open -na ${JSON.stringify(appBundle)} --args --remote-debugging-port=${DEBUG_PORT}`,
      { stdio: "inherit" },
    );
    return null;
  }

  const obsidianAppPath = resolveObsidianAppPath();
  const obsidianProcess = spawn(
    obsidianAppPath,
    [`--remote-debugging-port=${DEBUG_PORT}`],
    {
      stdio: "pipe",
      detached: true,
    },
  );

  obsidianProcess.stderr?.on("data", (data: Buffer) => {
    console.log("[Obsidian stderr]", data.toString());
  });
  obsidianProcess.stdout?.on("data", (data: Buffer) => {
    console.log("[Obsidian stdout]", data.toString());
  });

  obsidianProcess.unref();
  return obsidianProcess;
};

export const launchObsidian = async (
  vaultPath: string,
): Promise<{
  browser: Browser;
  page: Page;
  obsidianProcess: ChildProcess | null;
  originalObsidianConfig?: string;
}> => {
  const resolvedVaultPath = normalizeVaultPath(vaultPath);

  await killObsidianOnDebugPort();

  // Set the target vault as active in Obsidian's config before launching
  const originalObsidianConfig = setActiveVault(resolvedVaultPath);

  const obsidianProcess = launchObsidianWithDebugPort();

  // Wait for the debug port to be ready
  await waitForDebugPort(DEBUG_PORT, 60_000);

  // Connect to Obsidian via CDP with retry logic
  const browser = await connectWithRetry({
    url: `http://${CDP_HOST}:${DEBUG_PORT}`,
  });

  // Find the workspace page (not the dev console or other windows)
  const page = await findWorkspacePage(browser);

  await verifyActiveVault({ page, expectedPath: resolvedVaultPath });

  return { browser, page, obsidianProcess, originalObsidianConfig };
};

const connectWithRetry = async ({
  url,
  maxRetries = 5,
  delayMs = 1_000,
}: {
  url: string;
  maxRetries?: number;
  delayMs?: number;
}): Promise<Browser> => {
  let lastError: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await chromium.connectOverCDP(url);
    } catch (e) {
      lastError = e;
      console.log(
        `CDP connect attempt ${i + 1}/${maxRetries} failed, retrying in ${delayMs}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
};

const waitForDebugPort = async (
  port: number,
  timeoutMs: number,
): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`http://${CDP_HOST}:${port}/json/list`);
      if (response.ok) {
        const targets = (await response.json()) as unknown[];
        if (Array.isArray(targets) && targets.length > 0) return;
      }
    } catch {
      // Port not ready yet, retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `Obsidian debug port ${port} did not become ready within ${timeoutMs}ms. ` +
      `Ensure Obsidian CLI is enabled (Settings → General → Command line interface), ` +
      `reinstall the latest .app from obsidian.md/download, and quit other Obsidian instances.`,
  );
};
