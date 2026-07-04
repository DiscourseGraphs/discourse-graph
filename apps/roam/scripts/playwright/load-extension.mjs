import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  DEFAULT_ARTIFACT_DIR,
  REPO_ROOT,
  ROAM_APP_ROOT,
  openRoamSession,
  parseArgs,
  timestamp,
} from "./roam-session.mjs";

const ROOT_FILES = [
  { name: "extension.js", required: true, type: "text/javascript" },
  { name: "README.md", required: true, type: "text/markdown" },
  { name: "extension.css", required: false, type: "text/css" },
  { name: "CHANGELOG.md", required: false, type: "text/markdown" },
  { name: "package.json", required: false, type: "application/json" },
];

const runCommand = ({ command, args, cwd }) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });

const clickByDom = async (locator, timeout = 15_000) => {
  await locator.first().waitFor({ timeout });
  await locator.first().evaluate((element) => {
    element.scrollIntoView({ block: "center", inline: "nearest" });
    element.click();
  });
};

const closeOpenModals = async (page) => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const closeButtons = page.locator(
      ".rm-settings-close-button, .bp3-dialog button[aria-label='Close']",
    );

    if ((await closeButtons.count().catch(() => 0)) > 0) {
      await closeButtons.last().evaluate((element) => element.click());
      await page.waitForTimeout(500);
      continue;
    }

    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(250);
  }
};

const readPackageName = async (repoDir) => {
  try {
    const packageJson = JSON.parse(
      await fs.readFile(path.join(repoDir, "package.json"), "utf8"),
    );
    return typeof packageJson.name === "string" && packageJson.name.trim()
      ? packageJson.name.trim()
      : null;
  } catch {
    return null;
  }
};

const readFolderFiles = async (repoDir) => {
  const files = [];
  const missing = [];

  for (const file of ROOT_FILES) {
    const filePath = path.join(repoDir, file.name);
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) throw new Error("Not a file");
      files.push({
        name: file.name,
        content: await fs.readFile(filePath, "utf8"),
        type: file.type,
        lastModified: Math.floor(stat.mtimeMs),
      });
    } catch {
      if (file.required) missing.push(file.name);
    }
  }

  if (missing.length) {
    throw new Error(
      `Cannot load Roam extension folder. Missing required file(s): ${missing.join(
        ", ",
      )}`,
    );
  }

  return files;
};

const installDirectoryPickerShim = async ({ page, dirName, files }) => {
  await page.evaluate(
    ({ dirName: pageDirName, files: pageFiles }) => {
      const makeNotFound = (name) =>
        new DOMException(
          `A requested file or directory could not be found: ${name}`,
          "NotFoundError",
        );

      const makeFileHandle = (entry) => ({
        kind: "file",
        name: entry.name,
        async getFile() {
          return new File([entry.content], entry.name, {
            type: entry.type,
            lastModified: entry.lastModified,
          });
        },
        async isSameEntry(other) {
          return other === this;
        },
        async queryPermission() {
          return "granted";
        },
        async requestPermission() {
          return "granted";
        },
      });

      const handles = new Map(
        pageFiles.map((entry) => [entry.name, makeFileHandle(entry)]),
      );

      const directoryHandle = {
        kind: "directory",
        name: pageDirName,
        async getFileHandle(name) {
          const handle = handles.get(name);
          if (!handle) throw makeNotFound(name);
          return handle;
        },
        async getDirectoryHandle(name) {
          throw makeNotFound(name);
        },
        async resolve(possibleDescendant) {
          for (const [name, handle] of handles) {
            if (handle === possibleDescendant) return [name];
          }
          return null;
        },
        async isSameEntry(other) {
          return other === this;
        },
        async queryPermission() {
          return "granted";
        },
        async requestPermission() {
          return "granted";
        },
        async *entries() {
          for (const entry of handles.entries()) yield entry;
        },
        async *keys() {
          for (const key of handles.keys()) yield key;
        },
        async *values() {
          for (const handle of handles.values()) yield handle;
        },
        [Symbol.asyncIterator]() {
          return this.entries();
        },
      };

      Object.defineProperty(window, "showDirectoryPicker", {
        configurable: true,
        value: async () => directoryHandle,
      });
    },
    { dirName, files },
  );
};

const openRoamDepotSettings = async ({ page, timeout }) => {
  await closeOpenModals(page);
  await clickByDom(page.locator(".rm-topbar .bp3-icon-more"), timeout);
  await page
    .locator(".bp3-menu-item, .bp3-menu li, [role='menuitem']")
    .filter({ hasText: /^Settings$/i })
    .first()
    .click({ force: true, timeout });
  await page.locator(".rm-modal-dialog--settings").waitFor({ timeout });
  await clickByDom(
    page.locator("#bp3-tab-title_rm-settings-tabs_rm-depot-tab"),
    timeout,
  );
  await page
    .locator("#bp3-tab-panel_rm-settings-tabs_rm-depot-tab")
    .waitFor({ timeout });
};

const ensureDeveloperMode = async ({ page, timeout }) => {
  await clickByDom(
    page.locator(".rm-extensions-installed__header button.bp3-icon-cog"),
    timeout,
  );
  await page.waitForTimeout(500);

  if ((await page.locator(".bp3-icon-folder-new").count()) > 0) {
    return "already-enabled";
  }

  await page
    .locator(".bp3-menu-item, [role='menuitem']")
    .filter({ hasText: /developer mode/i })
    .first()
    .click({ force: true, timeout });
  await page.waitForFunction(
    () => Boolean(document.querySelector(".bp3-icon-folder-new")),
    undefined,
    { timeout },
  );
  return "enabled";
};

const removeExistingDeveloperExtensions = async ({ page, extensionName }) =>
  page.evaluate(async (name) => {
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let removed = 0;

    for (let pass = 0; pass < 10; pass += 1) {
      const row = Array.from(
        document.querySelectorAll(".rm-extension-installed"),
      ).find(
        (element) =>
          element
            .querySelector(".rm-extension-installed__name")
            ?.textContent?.trim() === name,
      );

      if (!row) break;

      row.querySelector("button.bp3-icon-cross")?.click();
      removed += 1;
      await pause(500);
    }

    return removed;
  }, extensionName);

const installCommandPaletteObserver = async (page) => {
  await page.evaluate(() => {
    window.__dgPlaywrightCommandLabels = [];
    window.__dgPlaywrightCommandCallbacks = {};

    const patchCommandPalette = () => {
      const commandPalette = window.roamAlphaAPI?.ui?.commandPalette;
      if (!commandPalette?.addCommand) return false;
      if (commandPalette.addCommand.__dgPlaywrightPatched) return true;

      const originalAddCommand = commandPalette.addCommand.bind(commandPalette);
      const patchedAddCommand = (command) => {
        if (command?.label?.startsWith("DG:")) {
          window.__dgPlaywrightCommandLabels.push(command.label);
          window.__dgPlaywrightCommandCallbacks[command.label] =
            command.callback;
        }
        return originalAddCommand(command);
      };
      patchedAddCommand.__dgPlaywrightPatched = true;
      commandPalette.addCommand = patchedAddCommand;
      return true;
    };

    if (patchCommandPalette()) return;

    const interval = window.setInterval(() => {
      if (patchCommandPalette()) window.clearInterval(interval);
    }, 250);
    window.setTimeout(() => window.clearInterval(interval), 30_000);
  });
};

const waitForDiscourseGraphLoaded = async ({ page, timeout }) => {
  await page.waitForFunction(
    () =>
      Boolean(
        window.roamjs?.extension?.queryBuilder?.runQuery &&
          window.roamjs?.extension?.queryBuilder?.getDiscourseNodes,
      ),
    undefined,
    { timeout },
  );
};

const getDiscourseGraphGlobalProof = async (page) =>
  page.evaluate(() => {
    const queryBuilder = window.roamjs?.extension?.queryBuilder;
    const getDiscourseNodes = queryBuilder?.getDiscourseNodes;
    const nodes =
      typeof getDiscourseNodes === "function" ? getDiscourseNodes() : null;

    return {
      hasRunQuery: typeof queryBuilder?.runQuery === "function",
      hasGetDiscourseNodes: typeof getDiscourseNodes === "function",
      discourseNodeCount: Array.isArray(nodes) ? nodes.length : null,
    };
  });

const verifyDiscourseGraphUi = async ({ page, timeout }) => {
  await page.waitForFunction(
    () =>
      window.__dgPlaywrightCommandLabels?.includes(
        "DG: Open - Discourse settings",
      ),
    undefined,
    { timeout },
  );

  const commandLabels = await page.evaluate(
    () => window.__dgPlaywrightCommandLabels || [],
  );

  await closeOpenModals(page);
  await page.evaluate(() => {
    const openSettings =
      window.__dgPlaywrightCommandCallbacks?.["DG: Open - Discourse settings"];
    if (typeof openSettings !== "function") {
      throw new Error("DG settings command callback was not registered.");
    }
    openSettings();
  });

  const dialog = page
    .locator(".bp3-dialog, .bp3-dialog-container")
    .filter({ hasText: /Discourse Graphs|Discourse settings|Query|Export/i })
    .last();
  await dialog.waitFor({ timeout });

  const dialogText = await dialog.innerText({ timeout }).catch(() => "");
  return {
    commandLabels,
    settingsDialogVisible: await dialog.isVisible().catch(() => false),
    settingsDialogText: dialogText.slice(0, 500),
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const slot = args.slot || process.env.DG_ROAM_PLAYWRIGHT_SLOT || "1";
  const timeout = args.timeout ? Number(args.timeout) : 45_000;
  const headless = args.headed ? false : process.env.HEADLESS !== "false";
  const distDir = path.resolve(args.dist || path.join(ROAM_APP_ROOT, "dist"));
  const outDir = path.resolve(args.out || DEFAULT_ARTIFACT_DIR);
  const screenshotName =
    args["screenshot-name"] ||
    `roam-load-extension-slot-${slot}-${timestamp()}.png`;
  const screenshotPath = path.join(outDir, screenshotName);
  const resultPath = path.join(
    outDir,
    `load-extension-slot-${slot}-last-run.json`,
  );

  if (!args["skip-build"]) {
    await runCommand({
      command: "pnpm",
      args: ["--filter", "roam", "build"],
      cwd: REPO_ROOT,
    });
  }

  const files = await readFolderFiles(distDir);
  const extensionName =
    args["extension-name"] || (await readPackageName(distDir)) || "roam";

  await fs.mkdir(outDir, { recursive: true });

  const { context, page, slotConfig } = await openRoamSession({
    slot,
    graphUrl: args.url,
    profileDir: args["profile-dir"],
    headless,
    timeout,
    allowInteractiveLogin: Boolean(args["allow-login"]),
  });

  const result = {
    ok: false,
    slot: slotConfig.slot,
    configuredGraphLoaded: null,
    pageTitleAvailable: null,
    profileDir: slotConfig.profileDir,
    distDir,
    extensionName,
    loadedFiles: files.map(({ name, content }) => ({
      name,
      bytes: Buffer.byteLength(content),
    })),
    screenshotPath,
    resultPath,
    headless,
    developerMode: null,
    removedExisting: 0,
    dgGlobal: null,
    dgUi: null,
    pageErrors: [],
    knownWarnings: [],
    capturedAt: null,
  };

  page.on("pageerror", (error) => {
    const message = error.message;
    if (
      message.includes("Failed to execute 'put' on 'IDBObjectStore'") &&
      message.includes("could not be cloned")
    ) {
      result.knownWarnings.push(message);
      return;
    }
    result.pageErrors.push(message);
  });

  try {
    await installDirectoryPickerShim({
      page,
      dirName: path.basename(distDir),
      files,
    });
    await installCommandPaletteObserver(page);
    await openRoamDepotSettings({ page, timeout });
    result.developerMode = await ensureDeveloperMode({ page, timeout });
    result.removedExisting = await removeExistingDeveloperExtensions({
      page,
      extensionName,
    });

    await page
      .locator(".rm-extensions-installed__header button.bp3-icon-folder-new")
      .click({ force: true, timeout });

    await waitForDiscourseGraphLoaded({ page, timeout });
    result.dgGlobal = await getDiscourseGraphGlobalProof(page);
    result.dgUi = await verifyDiscourseGraphUi({ page, timeout });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    result.ok = true;
    result.configuredGraphLoaded = page.url().startsWith(slotConfig.graphUrl);
    result.pageTitleAvailable = Boolean(await page.title());
    result.capturedAt = new Date().toISOString();
    await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (args["keep-open"]) {
      console.log("Browser context left open. Press Ctrl+C to close it.");
      await new Promise((resolve) => {
        process.once("SIGINT", resolve);
        process.once("SIGTERM", resolve);
      });
    }
    await context.close();
  }
};

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
