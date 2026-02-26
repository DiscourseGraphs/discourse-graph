import fs from "fs";
import path from "path";
import { spawn, execSync, type ChildProcess } from "child_process";
import { chromium, type Browser, type Page } from "@playwright/test";

const OBSIDIAN_PATH = "/Applications/Obsidian.app/Contents/MacOS/Obsidian";
const PLUGIN_ID = "@discourse-graph/obsidian";
const DEBUG_PORT = 9222;

export const createTestVault = (vaultPath: string): void => {
  // Clean up any existing vault
  cleanTestVault(vaultPath);

  // Create vault directories
  const obsidianDir = path.join(vaultPath, ".obsidian");
  const pluginDir = path.join(obsidianDir, "plugins", PLUGIN_ID);
  fs.mkdirSync(pluginDir, { recursive: true });

  // Write community-plugins.json to enable our plugin
  fs.writeFileSync(
    path.join(obsidianDir, "community-plugins.json"),
    JSON.stringify([PLUGIN_ID]),
  );

  // Write app.json to disable restricted mode (allows community plugins)
  fs.writeFileSync(
    path.join(obsidianDir, "app.json"),
    JSON.stringify({ livePreview: true }),
  );

  // Copy built plugin files from dist/ into the vault's plugin directory
  const distDir = path.join(__dirname, "..", "..", "dist");
  if (!fs.existsSync(distDir)) {
    throw new Error(
      `dist/ directory not found at ${distDir}. Run "pnpm build" first.`,
    );
  }

  const filesToCopy = ["main.js", "manifest.json", "styles.css"];
  for (const file of filesToCopy) {
    const src = path.join(distDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(pluginDir, file));
    }
  }
};

export const cleanTestVault = (vaultPath: string): void => {
  if (fs.existsSync(vaultPath)) {
    fs.rmSync(vaultPath, { recursive: true, force: true });
  }
};

/**
 * Launch Obsidian as a subprocess with remote debugging enabled,
 * then connect via Chrome DevTools Protocol.
 *
 * We can't use Playwright's electron.launch() because Obsidian's
 * executable is a launcher that loads an asar package and forks
 * a new process, which breaks Playwright's Electron API connection.
 */
export const launchObsidian = async (vaultPath: string): Promise<{
  browser: Browser;
  page: Page;
  obsidianProcess: ChildProcess;
}> => {
  // Kill any existing Obsidian instances to free the debug port
  try {
    execSync("pkill -f Obsidian", { stdio: "ignore" });
    // Wait for processes to fully exit
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  } catch {
    // No existing Obsidian processes — that's fine
  }

  // Launch Obsidian with remote debugging port
  const obsidianProcess = spawn(
    OBSIDIAN_PATH,
    [`--remote-debugging-port=${DEBUG_PORT}`, `--vault=${vaultPath}`],
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

  // Unref so the spawned process doesn't keep the test runner alive
  obsidianProcess.unref();

  // Wait for the debug port to be ready
  await waitForDebugPort(DEBUG_PORT, 30_000);

  // Connect to Obsidian via CDP
  const browser = await chromium.connectOverCDP(`http://localhost:${DEBUG_PORT}`);

  // Get the first browser context and page
  const context = browser.contexts()[0];
  if (!context) {
    throw new Error("No browser context found after connecting via CDP");
  }

  let page = context.pages()[0];
  if (!page) {
    page = await context.waitForEvent("page");
  }

  // Wait for Obsidian to finish initializing
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector(".workspace", { timeout: 30_000 });

  return { browser, page, obsidianProcess };
};

const waitForDebugPort = async (port: number, timeoutMs: number): Promise<void> => {
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
  throw new Error(`Obsidian debug port ${port} did not become ready within ${timeoutMs}ms`);
};
