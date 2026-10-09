import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { BrowserContext, BrowserType, Page } from "playwright";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openRoamSession } from "../playwright/roamSession";

const ENV_KEYS = [
  "DG_ROAM_PLAYWRIGHT_EMAIL_1",
  "DG_ROAM_PLAYWRIGHT_PASSWORD_1",
  "DG_ROAM_PLAYWRIGHT_GRAPH_URL_1",
  "HEADLESS",
] as const;

const originalEnv = new Map<string, string | undefined>();
const setEnv = (name: string, value: string): void => {
  Reflect.set(process.env, name, value);
};

beforeEach(() => {
  for (const key of ENV_KEYS) originalEnv.set(key, process.env[key]);
  setEnv("DG_ROAM_PLAYWRIGHT_EMAIL_1", "person@example.com");
  setEnv("DG_ROAM_PLAYWRIGHT_PASSWORD_1", "private");
  setEnv(
    "DG_ROAM_PLAYWRIGHT_GRAPH_URL_1",
    "https://roamresearch.com/#/app/fixture",
  );
});

afterEach(() => {
  for (const [key, value] of originalEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  originalEnv.clear();
});

const createPage = ({
  goto = vi.fn().mockResolvedValue(undefined),
}: {
  goto?: ReturnType<typeof vi.fn>;
} = {}): Page =>
  ({
    goto,
    locator: vi.fn(() => ({ count: vi.fn().mockResolvedValue(0) })),
    url: vi.fn(() => "https://roamresearch.com/#/app/fixture"),
    waitForFunction: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
  }) as unknown as Page;

describe("openRoamSession", () => {
  it("applies HEADLESS after environment resolution and exposes one close method", async () => {
    setEnv("HEADLESS", "false");
    const profileRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "dg-roam-session-"),
    );
    const page = createPage();
    const close = vi.fn().mockResolvedValue(undefined);
    const context = {
      close,
      pages: vi.fn(() => [page]),
    } as unknown as BrowserContext;
    const launchPersistentContext = vi.fn().mockResolvedValue(context);
    const chromium = {
      launchPersistentContext,
    } as unknown as BrowserType;

    try {
      const session = await openRoamSession({
        chromium,
        profileDir: path.join(profileRoot, "profile"),
      });

      expect(launchPersistentContext).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headless: false }),
      );
      expect(session.headless).toBe(false);
      await session.close();
      expect(close).toHaveBeenCalledOnce();
    } finally {
      await fs.rm(profileRoot, { recursive: true, force: true });
    }
  });

  it("closes the context when navigation fails", async () => {
    const profileRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "dg-roam-navigation-"),
    );
    const page = createPage({
      goto: vi.fn().mockRejectedValue(new Error("navigation failed")),
    });
    const close = vi.fn().mockResolvedValue(undefined);
    const chromium = {
      launchPersistentContext: vi.fn().mockResolvedValue({
        close,
        pages: vi.fn(() => [page]),
      }),
    } as unknown as BrowserType;

    try {
      await expect(
        openRoamSession({
          chromium,
          profileDir: path.join(profileRoot, "profile"),
        }),
      ).rejects.toThrow("navigation failed");
      expect(close).toHaveBeenCalledOnce();
    } finally {
      await fs.rm(profileRoot, { recursive: true, force: true });
    }
  });

  it("reports the locked slot and profile without exposing credentials", async () => {
    const profileRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "dg-roam-lock-"),
    );
    const profileDir = path.join(profileRoot, "profile");
    const chromium = {
      launchPersistentContext: vi
        .fn()
        .mockRejectedValue(new Error("ProcessSingleton profile in use")),
    } as unknown as BrowserType;

    try {
      await expect(
        openRoamSession({ chromium, profileDir, slot: "1" }),
      ).rejects.toThrow(
        `Could not open Playwright slot 1 because its profile is already in use: ${profileDir}`,
      );
    } finally {
      await fs.rm(profileRoot, { recursive: true, force: true });
    }
  });
});
