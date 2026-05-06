import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { spawn, execSync, type ChildProcess } from "child_process";
import { chromium, type Browser, type Page } from "@playwright/test";

const OBSIDIAN_PATH = "/Applications/Obsidian.app/Contents/MacOS/Obsidian";
const OBSIDIAN_CONFIG_PATH = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "obsidian",
  "obsidian.json",
);
const PLUGIN_ID = "@discourse-graph/obsidian";
const DEBUG_PORT = 9222;

/**
 * Returns the vault path to use for tests.
 * Reads from OBSIDIAN_TEST_VAULT env var, or falls back to the provided default.
 */
export const resolveVaultPath = (defaultPath: string): string =>
  // eslint-disable-next-line turboPlugin/no-undeclared-env-vars -- local dev-only, not a turbo cache key
  process.env.OBSIDIAN_TEST_VAULT ?? defaultPath;

/**
 * Whether we're using a custom vault (skip create/clean).
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
  const obsidianDir = path.join(vaultPath, ".obsidian");
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

  for (const file of ["main.js", "manifest.json", "styles.css"]) {
    const src = path.join(distDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(pluginDir, file));
    }
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
  if (fs.existsSync(vaultPath)) {
    fs.rmSync(vaultPath, { recursive: true, force: true });
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

  const original = fs.readFileSync(OBSIDIAN_CONFIG_PATH, "utf-8");
  const config = JSON.parse(original) as {
    vaults: Record<string, { path: string; ts: number; open?: boolean }>;
  };

  let targetId: string | undefined;
  for (const [id, vault] of Object.entries(config.vaults)) {
    delete vault.open;
    if (vault.path === vaultPath) {
      targetId = id;
    }
  }

  if (!targetId) {
    targetId = crypto.randomBytes(8).toString("hex");
    config.vaults[targetId] = { path: vaultPath, ts: Date.now() };
  }

  const targetVault = config.vaults[targetId]!;
  targetVault.open = true;
  targetVault.ts = Date.now();

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
 * Launch Obsidian as a subprocess with remote debugging enabled,
 * then connect via Chrome DevTools Protocol.
 *
 * We can't use Playwright's electron.launch() because Obsidian's
 * executable is a launcher that loads an asar package and forks
 * a new process, which breaks Playwright's Electron API connection.
 */
export const launchObsidian = async (
  vaultPath: string,
): Promise<{
  browser: Browser;
  page: Page;
  obsidianProcess: ChildProcess;
  originalObsidianConfig?: string;
}> => {
  // Kill only the process currently holding the debug port
  try {
    const pids = execSync(`lsof -ti tcp:${DEBUG_PORT}`, {
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

  // Set the target vault as active in Obsidian's config before launching
  const originalObsidianConfig = setActiveVault(vaultPath);

  // Launch Obsidian with remote debugging port
  const obsidianProcess = spawn(
    OBSIDIAN_PATH,
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

  // Wait for the debug port to be ready
  await waitForDebugPort(DEBUG_PORT, 30_000);

  // Connect to Obsidian via CDP with retry logic
  const browser = await connectWithRetry(`http://localhost:${DEBUG_PORT}`);

  // Find the workspace page (not the dev console or other windows)
  const page = await findWorkspacePage(browser);

  return { browser, page, obsidianProcess, originalObsidianConfig };
};

const connectWithRetry = async (
  url: string,
  maxRetries = 5,
  delayMs = 1_000,
): Promise<Browser> => {
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
      const response = await fetch(`http://localhost:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // Port not ready yet, retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `Obsidian debug port ${port} did not become ready within ${timeoutMs}ms`,
  );
};
