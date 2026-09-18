import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { BrowserContext, Locator, Page } from "playwright";
import { describe, expect, it, vi } from "vitest";
import {
  activateDeveloperExtension,
  classifyBrowserMessage,
  loadTestDefinition,
  waitForTestReady,
} from "../playwright/loadExtension";

const createInvisibleLocator = (): Locator =>
  ({
    first: vi.fn(() => ({ isVisible: vi.fn().mockResolvedValue(false) })),
  }) as unknown as Locator;

describe("loadExtension helpers", () => {
  it("classifies only the fake directory-handle clone warning as expected", () => {
    expect(
      classifyBrowserMessage(
        "Failed to execute 'put' on 'IDBObjectStore': object could not be cloned",
      ),
    ).toBe("expected-directory-handle-warning");
    expect(classifyBrowserMessage("extension crashed")).toBe("error");
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
