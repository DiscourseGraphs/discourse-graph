import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { type Locator, type Page } from "playwright";
import {
  DEFAULT_ARTIFACT_DIR,
  REPO_ROOT,
  ROAM_APP_ROOT,
  getBooleanArg,
  getEnvValue,
  getStringArg,
  openRoamSession,
  parseArgs,
  timestamp,
} from "./roam-session";

type ExtensionRootFile = {
  name: string;
  required: boolean;
  type: string;
};

type ExtensionFile = {
  name: string;
  content: string;
  type: string;
  lastModified: number;
};

type RunCommandOptions = {
  command: string;
  args: string[];
  cwd: string;
};

type PageTimeoutOptions = {
  page: Page;
  timeout: number;
};

type InstallDirectoryPickerShimOptions = {
  page: Page;
  dirName: string;
  files: ExtensionFile[];
};

type DeveloperMode = "already-enabled" | "enabled";

type DiscourseGraphGlobalProof = {
  hasRunQuery: boolean;
  hasGetDiscourseNodes: boolean;
  discourseNodeCount: number | null;
};

type DiscourseGraphUiProof = {
  commandLabels: string[];
  settingsDialogVisible: boolean;
  settingsDialogText: string;
};

type LoadedFileProof = {
  name: string;
  bytes: number;
};

type LoadExtensionResult = {
  ok: boolean;
  slot: string;
  configuredGraphLoaded: boolean | null;
  pageTitleAvailable: boolean | null;
  profileDir: string;
  distDir: string;
  extensionName: string;
  loadedFiles: LoadedFileProof[];
  screenshotPath: string;
  resultPath: string;
  headless: boolean;
  developerMode: DeveloperMode | null;
  removedExisting: number;
  dgGlobal: DiscourseGraphGlobalProof | null;
  dgUi: DiscourseGraphUiProof | null;
  pageErrors: string[];
  knownWarnings: string[];
  capturedAt: string | null;
};

type CommandPaletteCommand = {
  label?: string;
  callback?: () => void;
};

type CommandPaletteAddCommand = ((
  command: CommandPaletteCommand,
) => Promise<void>) & {
  __dgPlaywrightPatched?: boolean;
};

type DgPlaywrightWindow = {
  __dgPlaywrightCommandLabels?: string[];
  __dgPlaywrightCommandCallbacks?: Record<string, () => void>;
  roamAlphaAPI?: {
    ui?: {
      commandPalette?: {
        addCommand?: CommandPaletteAddCommand;
      };
    };
  };
  roamjs?: {
    extension?: {
      queryBuilder?: {
        runQuery?: unknown;
        getDiscourseNodes?: () => unknown;
      };
    };
  };
  showDirectoryPicker?: () => Promise<unknown>;
};

const ROOT_FILES: ExtensionRootFile[] = [
  { name: "extension.js", required: true, type: "text/javascript" },
  { name: "README.md", required: true, type: "text/markdown" },
  { name: "extension.css", required: false, type: "text/css" },
  { name: "CHANGELOG.md", required: false, type: "text/markdown" },
  { name: "package.json", required: false, type: "application/json" },
];

const runCommand = async ({
  command,
  args,
  cwd,
}: RunCommandOptions): Promise<void> =>
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

const clickByDom = async (
  locator: Locator,
  timeout = 15_000,
): Promise<void> => {
  await locator.first().waitFor({ timeout });
  await locator.first().evaluate((element: HTMLElement) => {
    element.scrollIntoView({ block: "center", inline: "nearest" });
    element.click();
  });
};

const closeOpenModals = async (page: Page): Promise<void> => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const closeButtons = page.locator(
      ".rm-settings-close-button, .bp3-dialog button[aria-label='Close']",
    );

    if ((await closeButtons.count().catch(() => 0)) > 0) {
      await closeButtons.last().evaluate((element: HTMLElement) => {
        element.click();
      });
      await page.waitForTimeout(500);
      continue;
    }

    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(250);
  }
};

const readPackageName = async (repoDir: string): Promise<string | null> => {
  try {
    const packageJson = JSON.parse(
      await fs.readFile(path.join(repoDir, "package.json"), "utf8"),
    ) as { name?: unknown };
    return typeof packageJson.name === "string" && packageJson.name.trim()
      ? packageJson.name.trim()
      : null;
  } catch {
    return null;
  }
};

const readFolderFiles = async (repoDir: string): Promise<ExtensionFile[]> => {
  const files: ExtensionFile[] = [];
  const missing: string[] = [];

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

const installDirectoryPickerShim = async ({
  page,
  dirName,
  files,
}: InstallDirectoryPickerShimOptions): Promise<void> => {
  await page.evaluate(
    ({ dirName: pageDirName, files: pageFiles }) => {
      type BrowserExtensionFile = {
        name: string;
        content: string;
        type: string;
        lastModified: number;
      };

      type BrowserFileHandle = {
        kind: "file";
        name: string;
        getFile: () => Promise<File>;
        isSameEntry: (other: unknown) => Promise<boolean>;
        queryPermission: () => Promise<PermissionState>;
        requestPermission: () => Promise<PermissionState>;
      };

      type BrowserDirectoryHandle = {
        kind: "directory";
        name: string;
        getFileHandle: (name: string) => Promise<BrowserFileHandle>;
        getDirectoryHandle: (name: string) => Promise<never>;
        resolve: (
          possibleDescendant: BrowserFileHandle,
        ) => Promise<string[] | null>;
        isSameEntry: (other: unknown) => Promise<boolean>;
        queryPermission: () => Promise<PermissionState>;
        requestPermission: () => Promise<PermissionState>;
        entries: () => AsyncGenerator<[string, BrowserFileHandle]>;
        keys: () => AsyncGenerator<string>;
        values: () => AsyncGenerator<BrowserFileHandle>;
        [Symbol.asyncIterator]: () => AsyncGenerator<
          [string, BrowserFileHandle]
        >;
      };

      const makeNotFound = (name: string): DOMException =>
        new DOMException(
          `A requested file or directory could not be found: ${name}`,
          "NotFoundError",
        );

      const makeFileHandle = (
        entry: BrowserExtensionFile,
      ): BrowserFileHandle => {
        const fileHandle: BrowserFileHandle = {
          kind: "file",
          name: entry.name,
          getFile: () =>
            Promise.resolve(
              new File([entry.content], entry.name, {
                type: entry.type,
                lastModified: entry.lastModified,
              }),
            ),
          isSameEntry: (other: unknown) =>
            Promise.resolve(other === fileHandle),
          queryPermission: () => Promise.resolve("granted"),
          requestPermission: () => Promise.resolve("granted"),
        };
        return fileHandle;
      };

      const handles = new Map<string, BrowserFileHandle>(
        pageFiles.map((entry) => [entry.name, makeFileHandle(entry)]),
      );

      const directoryHandle: BrowserDirectoryHandle = {
        kind: "directory",
        name: pageDirName,
        getFileHandle: (name: string) => {
          const handle = handles.get(name);
          return handle
            ? Promise.resolve(handle)
            : Promise.reject(makeNotFound(name));
        },
        getDirectoryHandle: (name: string) =>
          Promise.reject(makeNotFound(name)),
        resolve: (possibleDescendant: BrowserFileHandle) => {
          for (const [name, handle] of handles) {
            if (handle === possibleDescendant) return Promise.resolve([name]);
          }
          return Promise.resolve(null);
        },
        isSameEntry: (other: unknown) =>
          Promise.resolve(other === directoryHandle),
        queryPermission: () => Promise.resolve("granted"),
        requestPermission: () => Promise.resolve("granted"),
        async *entries() {
          await Promise.resolve();
          for (const entry of handles.entries()) yield entry;
        },
        async *keys() {
          await Promise.resolve();
          for (const key of handles.keys()) yield key;
        },
        async *values() {
          await Promise.resolve();
          for (const handle of handles.values()) yield handle;
        },
        [Symbol.asyncIterator]() {
          return this.entries();
        },
      };

      Object.defineProperty(
        window as unknown as DgPlaywrightWindow,
        "showDirectoryPicker",
        {
          configurable: true,
          value: () => Promise.resolve(directoryHandle),
        },
      );
    },
    { dirName, files },
  );
};

const openRoamDepotSettings = async ({
  page,
  timeout,
}: PageTimeoutOptions): Promise<void> => {
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

const ensureDeveloperMode = async ({
  page,
  timeout,
}: PageTimeoutOptions): Promise<DeveloperMode> => {
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

const removeExistingDeveloperExtensions = async ({
  page,
  extensionName,
}: {
  page: Page;
  extensionName: string;
}): Promise<number> =>
  page.evaluate(async (name: string): Promise<number> => {
    const pause = (ms: number): Promise<void> =>
      new Promise((resolve) => window.setTimeout(resolve, ms));
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

      row.querySelector<HTMLButtonElement>("button.bp3-icon-cross")?.click();
      removed += 1;
      await pause(500);
    }

    return removed;
  }, extensionName);

const installCommandPaletteObserver = async (page: Page): Promise<void> => {
  await page.evaluate((): void => {
    const dgWindow = window as unknown as DgPlaywrightWindow;
    dgWindow.__dgPlaywrightCommandLabels = [];
    dgWindow.__dgPlaywrightCommandCallbacks = {};

    const patchCommandPalette = (): boolean => {
      const commandPalette = dgWindow.roamAlphaAPI?.ui?.commandPalette;
      const addCommand = commandPalette?.addCommand;
      if (!addCommand) return false;
      if (addCommand.__dgPlaywrightPatched) return true;

      const originalAddCommand = addCommand.bind(commandPalette) as (
        command: CommandPaletteCommand,
      ) => Promise<void>;
      const patchedAddCommand: CommandPaletteAddCommand = async (command) => {
        if (command.label?.startsWith("DG:")) {
          dgWindow.__dgPlaywrightCommandLabels?.push(command.label);
          if (command.callback) {
            dgWindow.__dgPlaywrightCommandCallbacks = {
              ...dgWindow.__dgPlaywrightCommandCallbacks,
              [command.label]: command.callback,
            };
          }
        }
        await originalAddCommand(command);
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

const waitForDiscourseGraphLoaded = async ({
  page,
  timeout,
}: PageTimeoutOptions): Promise<void> => {
  await page.waitForFunction(
    () => {
      const dgWindow = window as unknown as DgPlaywrightWindow;
      return Boolean(
        dgWindow.roamjs?.extension?.queryBuilder?.runQuery &&
          dgWindow.roamjs?.extension?.queryBuilder?.getDiscourseNodes,
      );
    },
    undefined,
    { timeout },
  );
};

const getDiscourseGraphGlobalProof = async (
  page: Page,
): Promise<DiscourseGraphGlobalProof> =>
  page.evaluate((): DiscourseGraphGlobalProof => {
    const dgWindow = window as unknown as DgPlaywrightWindow;
    const queryBuilder = dgWindow.roamjs?.extension?.queryBuilder;
    const getDiscourseNodes = queryBuilder?.getDiscourseNodes;
    const nodes =
      typeof getDiscourseNodes === "function" ? getDiscourseNodes() : null;

    return {
      hasRunQuery: typeof queryBuilder?.runQuery === "function",
      hasGetDiscourseNodes: typeof getDiscourseNodes === "function",
      discourseNodeCount: Array.isArray(nodes) ? nodes.length : null,
    };
  });

const verifyDiscourseGraphUi = async ({
  page,
  timeout,
}: PageTimeoutOptions): Promise<DiscourseGraphUiProof> => {
  await page.waitForFunction(
    () => {
      const dgWindow = window as unknown as DgPlaywrightWindow;
      return dgWindow.__dgPlaywrightCommandLabels?.includes(
        "DG: Open - Discourse settings",
      );
    },
    undefined,
    { timeout },
  );

  const commandLabels = await page.evaluate(
    (): string[] =>
      (window as unknown as DgPlaywrightWindow).__dgPlaywrightCommandLabels ||
      [],
  );

  await closeOpenModals(page);
  await page.evaluate((): void => {
    const dgWindow = window as unknown as DgPlaywrightWindow;
    const openSettings =
      dgWindow.__dgPlaywrightCommandCallbacks?.[
        "DG: Open - Discourse settings"
      ];
    if (!openSettings) {
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

const waitForTermination = async (): Promise<void> =>
  new Promise((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  const slot =
    getStringArg(args, "slot") || getEnvValue("DG_ROAM_PLAYWRIGHT_SLOT") || "1";
  const timeout = Number(getStringArg(args, "timeout") || 45_000);
  const headless = getBooleanArg(args, "headed")
    ? false
    : getEnvValue("HEADLESS") !== "false";
  const distDir = path.resolve(
    getStringArg(args, "dist") || path.join(ROAM_APP_ROOT, "dist"),
  );
  const outDir = path.resolve(
    getStringArg(args, "out") || DEFAULT_ARTIFACT_DIR,
  );
  const screenshotName =
    getStringArg(args, "screenshot-name") ||
    `roam-load-extension-slot-${slot}-${timestamp()}.png`;
  const screenshotPath = path.join(outDir, screenshotName);
  const resultPath = path.join(
    outDir,
    `load-extension-slot-${slot}-last-run.json`,
  );

  if (!getBooleanArg(args, "skip-build")) {
    await runCommand({
      command: "pnpm",
      args: ["--filter", "roam", "build"],
      cwd: REPO_ROOT,
    });
  }

  const files = await readFolderFiles(distDir);
  const extensionName =
    getStringArg(args, "extension-name") ||
    (await readPackageName(distDir)) ||
    "roam";

  await fs.mkdir(outDir, { recursive: true });

  const { context, page, slotConfig } = await openRoamSession({
    slot,
    graphUrl: getStringArg(args, "url"),
    profileDir: getStringArg(args, "profile-dir"),
    headless,
    timeout,
    allowInteractiveLogin: getBooleanArg(args, "allow-login"),
  });

  const result: LoadExtensionResult = {
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
    if (getBooleanArg(args, "keep-open")) {
      console.log("Browser context left open. Press Ctrl+C to close it.");
      await waitForTermination();
    }
    await context.close();
  }
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : error;
  console.error(message);
  process.exit(1);
});
