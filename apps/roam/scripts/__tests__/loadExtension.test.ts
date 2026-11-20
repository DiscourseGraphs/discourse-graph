import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { BrowserContext, Locator, Page } from "playwright";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activateDeveloperExtension,
  installDirectoryPickerShim,
  loadTestDefinition,
  waitForTestReady,
} from "../playwright/loadExtension";

const createInvisibleLocator = (): Locator =>
  ({
    first: vi.fn(() => ({ isVisible: vi.fn().mockResolvedValue(false) })),
  }) as unknown as Locator;

afterEach(() => vi.unstubAllGlobals());

describe("loadExtension helpers", () => {
  it("returns the native handle after staging files and removing stale optional files", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const directory = {
      getFileHandle: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue({ write, close }),
      }),
      removeEntry: vi.fn().mockResolvedValue(undefined),
    };
    const previews = {
      getDirectoryHandle: vi.fn().mockResolvedValue(directory),
    };
    const root = { getDirectoryHandle: vi.fn().mockResolvedValue(previews) };
    vi.stubGlobal("navigator", {
      storage: { getDirectory: vi.fn().mockResolvedValue(root) },
    });
    const browserWindow = { showDirectoryPicker: vi.fn() };
    vi.stubGlobal("window", browserWindow);
    const page = {
      evaluate: vi.fn(
        (callback: (args: unknown) => Promise<unknown>, args: unknown) =>
          callback(args),
      ),
    } as unknown as Page;
    await installDirectoryPickerShim({
      page,
      dirName: "dist",
      files: [
        {
          name: "extension.js",
          content: "bundle",
          type: "text/javascript",
          lastModified: 0,
        },
        {
          name: "README.md",
          content: "readme",
          type: "text/markdown",
          lastModified: 0,
        },
      ],
    });
    expect(root.getDirectoryHandle).toHaveBeenCalledWith(
      "dg-playwright-extensions",
      { create: true },
    );
    expect(previews.getDirectoryHandle).toHaveBeenCalledWith("dist", {
      create: true,
    });
    expect(write.mock.calls).toEqual([["bundle"], ["readme"]]);
    expect(close).toHaveBeenCalledTimes(2);
    expect(directory.removeEntry.mock.calls).toEqual([
      ["extension.css"],
      ["CHANGELOG.md"],
      ["package.json"],
    ]);
    expect(await browserWindow.showDirectoryPicker()).toBe(directory);
  });

  it("fails without installing a fake handle when persistent storage is unavailable", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        getDirectory: vi
          .fn()
          .mockRejectedValue(new Error("storage unavailable")),
      },
    });
    const picker = vi.fn();
    const browserWindow = { showDirectoryPicker: picker };
    vi.stubGlobal("window", browserWindow);
    const page = {
      evaluate: vi.fn(
        (callback: (args: unknown) => Promise<unknown>, args: unknown) =>
          callback(args),
      ),
    } as unknown as Page;
    await expect(
      installDirectoryPickerShim({ page, dirName: "dist", files: [] }),
    ).rejects.toThrow("storage unavailable");
    expect(browserWindow.showDirectoryPicker).toBe(picker);
  });

  it("loads caller modules through file URLs when paths contain spaces", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "dg roam module "));
    const moduleDir = path.join(root, "proof module");
    const modulePath = path.join(moduleDir, "test.mjs");
    await fs.mkdir(moduleDir, { recursive: true });
    await fs.writeFile(
      modulePath,
      'export default { registrationName: "dist", async run() { return 42; } };\n',
    );

    try {
      const definition = await loadTestDefinition(modulePath);
      expect(definition?.modulePath).toBe(modulePath);
      expect(definition?.registrationName).toBe("dist");
      expect(await definition?.run?.({} as never)).toBe(42);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("allows automatic activation when no refresh control is visible", async () => {
    const page = {
      locator: vi.fn(() => createInvisibleLocator()),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
    } as unknown as Page;
    const row = {
      locator: vi.fn(() => createInvisibleLocator()),
    } as unknown as Locator;

    await expect(
      activateDeveloperExtension({ page, row, timeout: 100 }),
    ).resolves.toBe("automatic");
  });

  it("retries a caller readiness predicate in the existing context", async () => {
    const ready = vi
      .fn()
      .mockRejectedValueOnce(new Error("not registered yet"))
      .mockResolvedValue(true);
    const page = {
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
    } as unknown as Page;
    const context = {} as BrowserContext;

    await expect(
      waitForTestReady({
        page,
        context,
        definition: { ready },
        timeout: 1_000,
      }),
    ).resolves.toBeUndefined();
    expect(ready).toHaveBeenCalledTimes(2);
  });
});
