import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { type BrowserContext, type Locator, type Page } from "playwright";
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
} from "./roamSession";

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
type ExtensionActivation = "automatic" | "header-refresh" | "row-refresh";

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
  developerExtensionName: string;
  loadedFiles: LoadedFileProof[];
  screenshotPath: string;
  resultPath: string;
  headless: boolean;
  developerMode: DeveloperMode | null;
  activation: ExtensionActivation | null;
  removedExisting: number;
  dgGlobal: DiscourseGraphGlobalProof | null;
  dgUi: DiscourseGraphUiProof | null;
  pageErrors: string[];
  consoleMessages: string[];
  failedRequests: string[];
  knownWarnings: string[];
  phases: Record<string, { ok: boolean; durationMs: number; error?: string }>;
  testModule: string | null;
  test: { ok: boolean; value?: unknown; error?: string } | null;
  cleanup: { ok: boolean; value?: unknown; error?: string } | null;
  diagnostics: Record<string, unknown> | null;
  failureScreenshotPath: string | null;
  error: string | null;
  capturedAt: string | null;
};

type ExtensionTestHookOptions = {
  context: BrowserContext;
  page: Page;
  outDir: string;
  distDir: string;
  result: LoadExtensionResult;
};

export type ExtensionTestDefinition = {
  registrationName?: string;
  readySelector?: string;
  ready?: (
    options: Pick<ExtensionTestHookOptions, "context" | "page">,
  ) => boolean | Promise<boolean>;
  run?: (options: ExtensionTestHookOptions) => unknown;
  cleanup?: (options: ExtensionTestHookOptions & { state: unknown }) => unknown;
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

export const ROOT_FILES: ExtensionRootFile[] = [
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

const clickNative = async (
  locator: Locator,
  timeout = 15_000,
): Promise<void> => {
  const target = locator.first();
  await target.waitFor({ state: "visible", timeout });
  await target.scrollIntoViewIfNeeded();
  await target.click({ timeout });
};

export const classifyBrowserMessage = (
  message: string,
): "expected-directory-handle-warning" | "error" =>
  message.includes("Failed to execute 'put' on 'IDBObjectStore'") &&
  message.includes("could not be cloned")
    ? "expected-directory-handle-warning"
    : "error";

export const loadTestDefinition = async (
  testModulePath?: string,
): Promise<(ExtensionTestDefinition & { modulePath: string }) | null> => {
  if (!testModulePath) return null;
  const modulePath = path.resolve(testModulePath);
  const moduleUrl = pathToFileURL(modulePath);
  moduleUrl.searchParams.set("run", Date.now().toString());
  const imported = (await import(moduleUrl.href)) as {
    default?: ExtensionTestDefinition;
  } & ExtensionTestDefinition;
  const definition = imported.default || imported;
  if (!definition || typeof definition !== "object") {
    throw new Error(`Test module must export an object: ${modulePath}`);
  }
  return { ...definition, modulePath };
};

const closeOpenModals = async (page: Page): Promise<void> => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const closeButtons = page.locator(
      ".rm-settings-close-button, .bp3-dialog button[aria-label='Close']",
    );

    if ((await closeButtons.count().catch(() => 0)) > 0) {
      await closeButtons
        .last()
        .click({ force: true })
        .catch(() => undefined);
      await page.waitForTimeout(500);
      continue;
    }

    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(250);
  }
};

const installSerializedFunctionShim = async (page: Page): Promise<void> => {
  // tsx can serialize Playwright-evaluated closures with esbuild's name helper.
  await page.evaluate(
    "window.__name = (target, value) => Object.defineProperty(target, 'name', { value, configurable: true })",
  );
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
  await clickNative(page.locator(".rm-topbar .bp3-icon-more"), timeout);
  await clickNative(
    page
      .locator(".bp3-menu-item, .bp3-menu li, [role='menuitem']")
      .filter({ hasText: /^Settings$/i }),
    timeout,
  );
  await page.locator(".rm-modal-dialog--settings").waitFor({ timeout });
  await clickNative(
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
  await clickNative(
    page.locator(".rm-extensions-installed__header button.bp3-icon-cog"),
    timeout,
  );
  await page.waitForTimeout(500);

  const folderButton = page.locator(
    ".rm-extensions-installed__header button.bp3-icon-folder-new",
  );
  if (
    await folderButton
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    return "already-enabled";
  }

  let enableDeveloperMode = page
    .locator(".bp3-menu-item, .bp3-menu li, [role='menuitem'], button")
    .filter({ hasText: /^Enable developer mode$/i });
  if ((await enableDeveloperMode.count()) === 0) {
    enableDeveloperMode = page
      .locator(".bp3-menu-item, .bp3-menu li, [role='menuitem'], button")
      .filter({ hasText: /enable.*developer mode|developer mode.*enable/i });
  }
  await clickNative(enableDeveloperMode, timeout);
  await folderButton.first().waitFor({ state: "visible", timeout });
  return "enabled";
};

const removeExistingDeveloperExtensions = async ({
  page,
  extensionNames,
  timeout,
}: {
  page: Page;
  extensionNames: string[];
  timeout: number;
}): Promise<number> => {
  let removed = 0;

  for (const extensionName of new Set(extensionNames)) {
    for (let pass = 0; pass < 10; pass += 1) {
      const matchingName = page
        .locator(".rm-extension-installed__name")
        .filter({ hasText: new RegExp(`^${escapeRegExp(extensionName)}$`) })
        .first();
      if ((await matchingName.count()) === 0) break;

      const row = matchingName.locator(
        "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' rm-extension-installed ')][1]",
      );
      await clickNative(row.locator("button.bp3-icon-cross"), timeout);
      removed += 1;
      await matchingName
        .waitFor({ state: "detached", timeout })
        .catch(() => undefined);
      await page.waitForTimeout(250);
    }
  }

  return removed;
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const registerDeveloperExtension = async ({
  page,
  extensionName,
  timeout,
}: {
  page: Page;
  extensionName: string;
  timeout: number;
}): Promise<Locator> => {
  await clickNative(
    page.locator(".rm-extensions-installed__header button.bp3-icon-folder-new"),
    timeout,
  );
  const extensionRowName = page
    .locator(".rm-extension-installed__name")
    .filter({ hasText: new RegExp(`^${escapeRegExp(extensionName)}$`) })
    .last();
  await extensionRowName.waitFor({ state: "visible", timeout });
  return extensionRowName.locator(
    "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' rm-extension-installed ')][1]",
  );
};

export const activateDeveloperExtension = async ({
  page,
  row,
  timeout,
}: {
  page: Page;
  row: Locator;
  timeout: number;
}): Promise<ExtensionActivation> => {
  const headerRefresh = page.locator(
    ".rm-extensions-installed__header button.bp3-icon-refresh, .rm-extensions-installed__header button[aria-label*='refresh' i], .rm-extensions-installed__header button[title*='refresh' i]",
  );
  if (
    await headerRefresh
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    await clickNative(headerRefresh, timeout);
    await page.waitForTimeout(500);
    return "header-refresh";
  }

  const rowRefresh = row.locator(
    "button.bp3-icon-refresh, button[aria-label*='refresh' i], button[title*='refresh' i]",
  );
  if (
    await rowRefresh
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    await clickNative(rowRefresh, timeout);
    await page.waitForTimeout(500);
    return "row-refresh";
  }

  return "automatic";
};

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
  const commandWasCaptured = await page
    .waitForFunction(
      () => {
        const dgWindow = window as unknown as DgPlaywrightWindow;
        return dgWindow.__dgPlaywrightCommandLabels?.includes(
          "DG: Open - Discourse settings",
        );
      },
      undefined,
      { timeout: Math.min(timeout, 5_000) },
    )
    .then(() => true)
    .catch(() => false);

  const commandLabels = await page.evaluate(
    (): string[] =>
      (window as unknown as DgPlaywrightWindow).__dgPlaywrightCommandLabels ||
      [],
  );

  if (commandWasCaptured) {
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
  } else {
    await clickNative(
      page
        .locator(".rm-modal-dialog--settings")
        .getByText(/^Discourse Graphs(?: \(dev\))?$/)
        .first(),
      timeout,
    );
    await clickNative(
      page.locator(".rm-modal-dialog--settings button", {
        hasText: /^Open Settings$/i,
      }),
      timeout,
    );
  }

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

export const waitForTestReady = async ({
  page,
  context,
  definition,
  timeout,
}: {
  page: Page;
  context: BrowserContext;
  definition: ExtensionTestDefinition;
  timeout: number;
}): Promise<void> => {
  if (!definition.ready && !definition.readySelector) return;

  const deadline = Date.now() + timeout;
  let lastError: string | null = null;
  while (Date.now() < deadline) {
    const selectorReady = definition.readySelector
      ? await page
          .locator(definition.readySelector)
          .first()
          .isVisible()
          .catch(() => false)
      : false;
    let callerReady = false;
    if (definition.ready) {
      try {
        callerReady = Boolean(await definition.ready({ page, context }));
        lastError = null;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    if (selectorReady || callerReady) return;
    await page.waitForTimeout(250);
  }

  throw new Error(
    `The caller test module did not become ready. Selector: ${definition.readySelector || "none"}; last predicate error: ${lastError || "none"}.`,
  );
};

const captureDiagnostics = async (
  page: Page,
): Promise<Record<string, unknown> | null> =>
  page
    .evaluate(() => ({
      url: location.href,
      loadedExtensions: (() => {
        const getLoadedName = (value: unknown): string => {
          if (typeof value === "string") return value;
          if (
            value &&
            typeof value === "object" &&
            "name" in value &&
            typeof value.name === "string"
          ) {
            return value.name;
          }
          return `[${typeof value}]`;
        };
        const loaded = (window as unknown as { roamjs?: { loaded?: unknown } })
          .roamjs?.loaded;
        if (!loaded) return [];
        if (Array.isArray(loaded)) return loaded.map(getLoadedName);
        if (loaded instanceof Set) return Array.from(loaded, getLoadedName);
        if (typeof loaded === "object") return Object.keys(loaded);
        return [getLoadedName(loaded)];
      })(),
      depotButtons: Array.from(
        document.querySelectorAll(
          "#bp3-tab-panel_rm-settings-tabs_rm-depot-tab button",
        ),
      )
        .map((button) => ({
          text: button.textContent?.trim() || "",
          ariaLabel: button.getAttribute("aria-label"),
          title: button.getAttribute("title"),
          className: button.className,
        }))
        .slice(0, 50),
      visibleText: document.body.innerText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 200),
    }))
    .catch(() => null);

const createPhaseRunner =
  (result: LoadExtensionResult) =>
  async <T>(name: string, callback: () => Promise<T>): Promise<T> => {
    const startedAt = Date.now();
    try {
      const value = await callback();
      result.phases[name] = {
        ok: true,
        durationMs: Date.now() - startedAt,
      };
      return value;
    } catch (error) {
      result.phases[name] = {
        ok: false,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      };
      throw error;
    }
  };

const waitForTermination = async (): Promise<void> =>
  new Promise((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });

export const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  const slot =
    getStringArg(args, "slot") || getEnvValue("DG_ROAM_PLAYWRIGHT_SLOT") || "1";
  const timeout = Number(getStringArg(args, "timeout") || 45_000);
  const headless = getBooleanArg(args, "headed") ? false : undefined;
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
  const failureScreenshotPath = path.join(
    outDir,
    `roam-load-extension-slot-${slot}-failure.png`,
  );
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
  const testDefinition = await loadTestDefinition(
    getStringArg(args, "test-module"),
  );
  const extensionName =
    getStringArg(args, "extension-name") ||
    (await readPackageName(distDir)) ||
    "roam";
  const developerExtensionName =
    getStringArg(args, "registration-name") ||
    testDefinition?.registrationName ||
    path.basename(distDir);

  await fs.mkdir(outDir, { recursive: true });

  const sessionStartedAt = Date.now();
  const session = await openRoamSession({
    slot,
    graphUrl: getStringArg(args, "url"),
    profileDir: getStringArg(args, "profile-dir"),
    headless,
    timeout,
    allowInteractiveLogin: getBooleanArg(args, "allow-login"),
  });
  const { context, page, slotConfig } = session;

  const result: LoadExtensionResult = {
    ok: false,
    slot: slotConfig.slot,
    configuredGraphLoaded: null,
    pageTitleAvailable: null,
    profileDir: slotConfig.profileDir,
    distDir,
    extensionName,
    developerExtensionName,
    loadedFiles: files.map(({ name, content }) => ({
      name,
      bytes: Buffer.byteLength(content),
    })),
    screenshotPath,
    resultPath,
    headless: session.headless,
    developerMode: null,
    activation: null,
    removedExisting: 0,
    dgGlobal: null,
    dgUi: null,
    pageErrors: [],
    consoleMessages: [],
    failedRequests: [],
    knownWarnings: [],
    phases: {
      session: {
        ok: true,
        durationMs: Date.now() - sessionStartedAt,
      },
    },
    testModule: testDefinition?.modulePath || null,
    test: null,
    cleanup: null,
    diagnostics: null,
    failureScreenshotPath: null,
    error: null,
    capturedAt: null,
  };

  const pushBounded = (messages: string[], message: string): void => {
    messages.push(message);
    if (messages.length > 50) messages.shift();
  };

  const warningKeys = new Set<string>();
  const recordBrowserMessage = ({
    message,
    source,
  }: {
    message: string;
    source: "console" | "pageerror";
  }): void => {
    if (
      classifyBrowserMessage(message) === "expected-directory-handle-warning"
    ) {
      if (!warningKeys.has(message)) result.knownWarnings.push(message);
      warningKeys.add(message);
      return;
    }
    if (source === "pageerror") result.pageErrors.push(message);
  };

  page.on("console", (message) => {
    const text = `${message.type()}: ${message.text()}`;
    if (message.type() === "error") {
      if (
        classifyBrowserMessage(message.text()) ===
        "expected-directory-handle-warning"
      ) {
        recordBrowserMessage({ message: message.text(), source: "console" });
        return;
      }
      recordBrowserMessage({ message: message.text(), source: "console" });
    }
    pushBounded(result.consoleMessages, text);
  });

  page.on("requestfailed", (request) => {
    pushBounded(
      result.failedRequests,
      `${request.url()} ${request.failure()?.errorText || ""}`.trim(),
    );
  });

  page.on("pageerror", (error) => {
    recordBrowserMessage({ message: error.message, source: "pageerror" });
  });

  const persistResult = async (): Promise<void> => {
    result.configuredGraphLoaded = page.url().startsWith(slotConfig.graphUrl);
    result.pageTitleAvailable = Boolean(await page.title().catch(() => ""));
    result.capturedAt = new Date().toISOString();
    if (!result.ok) {
      result.diagnostics = await captureDiagnostics(page);
      result.failureScreenshotPath = failureScreenshotPath;
      await page
        .screenshot({ path: failureScreenshotPath, fullPage: false })
        .catch(() => undefined);
    }
    await page
      .screenshot({ path: screenshotPath, fullPage: false })
      .catch(() => undefined);
    await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  };

  const phase = createPhaseRunner(result);
  let testState: unknown;
  let testStarted = false;
  let primaryError: unknown = null;

  try {
    await phase("picker-shim", async () => {
      await installSerializedFunctionShim(page);
      await installDirectoryPickerShim({
        page,
        dirName: path.basename(distDir),
        files,
      });
      await installCommandPaletteObserver(page);
    });
    await phase("open-depot", () => openRoamDepotSettings({ page, timeout }));
    result.developerMode = await phase("developer-mode", () =>
      ensureDeveloperMode({ page, timeout }),
    );
    result.removedExisting = await phase("remove-existing", () =>
      removeExistingDeveloperExtensions({
        page,
        extensionNames: [extensionName, developerExtensionName],
        timeout,
      }),
    );
    const row = await phase("register", () =>
      registerDeveloperExtension({
        page,
        extensionName: developerExtensionName,
        timeout,
      }),
    );
    result.activation = await phase("activate", () =>
      activateDeveloperExtension({ page, row, timeout }),
    );

    await phase("dg-ready", () =>
      waitForDiscourseGraphLoaded({ page, timeout }),
    );
    result.dgGlobal = await phase("dg-global-proof", () =>
      getDiscourseGraphGlobalProof(page),
    );
    result.dgUi = await phase("dg-ui-proof", () =>
      verifyDiscourseGraphUi({ page, timeout }),
    );
    if (testDefinition) {
      await phase("test-ready", () =>
        waitForTestReady({
          page,
          context,
          definition: testDefinition,
          timeout,
        }),
      );
    }
    if (testDefinition?.run) {
      testStarted = true;
      testState = await phase("test", () =>
        Promise.resolve(
          testDefinition.run?.({
            context,
            page,
            outDir,
            distDir,
            result,
          }),
        ),
      );
      result.test = { ok: true, value: testState };
    }
    await page.waitForTimeout(1500);
    if (result.pageErrors.length > 0) {
      throw new Error(
        `The extension produced ${result.pageErrors.length} page error(s).`,
      );
    }

    result.ok = true;
  } catch (error: unknown) {
    primaryError = error;
    result.error =
      error instanceof Error ? error.stack || error.message : String(error);
    if (testStarted && !result.test) {
      result.test = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  } finally {
    if (testStarted && testDefinition?.cleanup) {
      try {
        const value = await phase("cleanup", () =>
          Promise.resolve(
            testDefinition.cleanup?.({
              context,
              page,
              outDir,
              distDir,
              result,
              state: testState,
            }),
          ),
        );
        result.cleanup = { ok: true, value };
      } catch (error) {
        result.cleanup = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
        result.ok = false;
        if (!primaryError) {
          primaryError = error;
          result.error =
            error instanceof Error
              ? error.stack || error.message
              : String(error);
        }
      }
    }
    try {
      await persistResult();
    } catch (error) {
      result.ok = false;
      if (!primaryError) {
        primaryError = error;
        result.error =
          error instanceof Error ? error.stack || error.message : String(error);
      }
    }
    if (getBooleanArg(args, "keep-open")) {
      console.log("Browser context left open. Press Ctrl+C to close it.");
      await waitForTermination();
    }
    try {
      await session.close();
    } catch (error) {
      result.ok = false;
      if (!primaryError) {
        primaryError = error;
        result.error =
          error instanceof Error ? error.stack || error.message : String(error);
      }
      await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
    }
  }

  if (primaryError) {
    console.error(JSON.stringify(result, null, 2));
    if (primaryError instanceof Error) throw primaryError;
    throw new Error(
      typeof primaryError === "string"
        ? primaryError
        : "The extension loader failed with a non-Error value.",
    );
  }
  console.log(JSON.stringify(result, null, 2));
};

if (require.main === module) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.stack || error.message : error;
    console.error(message);
    process.exit(1);
  });
}
