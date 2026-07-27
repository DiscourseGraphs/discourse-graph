import { describe, expect, it } from "vitest";
import {
  buildExtensionTelemetryProperties,
  getOrCreateExtensionInstallId,
} from "~/utils/extensionTelemetry";
import type { VersionMetadata } from "~/utils/getVersion";

const createStorage = (values = new Map<string, string>()) => ({
  getItem: (key: string): string | null => values.get(key) || null,
  setItem: (key: string, value: string): void => {
    values.set(key, value);
  },
});

const versionMetadata: VersionMetadata = {
  version: "0.21.0",
  buildDate: "2026-06-22",
  buildCommit: "1234567890abcdef",
  buildBranch: "main",
  versionStamp: "0.21.0-2026-06-22-12345678",
};

describe("getOrCreateExtensionInstallId", () => {
  it("reuses an existing install ID from storage", () => {
    const storage = {
      getItem: (): string => " install-id-1 ",
      setItem: (): void => {
        throw new Error("setItem should not be called");
      },
    };

    expect(
      getOrCreateExtensionInstallId({
        storage,
        createId: () => "new-id",
      }),
    ).toBe("install-id-1");
  });

  it("creates and persists an install ID when storage is empty", () => {
    const values = new Map<string, string>();
    const storage = createStorage(values);

    expect(
      getOrCreateExtensionInstallId({
        storage,
        createId: () => "new-id",
      }),
    ).toBe("new-id");
    expect([...values.values()]).toEqual(["new-id"]);
    expect(
      getOrCreateExtensionInstallId({
        storage,
        createId: () => "second-id",
      }),
    ).toBe("new-id");
  });

  it("falls back to a runtime ID when storage throws", () => {
    const storage = {
      getItem: (): string => {
        throw new Error("storage blocked");
      },
      setItem: (): void => undefined,
    };

    expect(
      getOrCreateExtensionInstallId({
        storage,
        createId: () => "runtime-id",
      }),
    ).toBe("runtime-id");
  });

  it("returns the generated ID when storage cannot persist it", () => {
    let calls = 0;
    const storage = {
      getItem: (): null => null,
      setItem: (): void => {
        throw new Error("storage blocked");
      },
    };

    expect(
      getOrCreateExtensionInstallId({
        storage,
        createId: () => {
          calls += 1;
          return `runtime-id-${calls}`;
        },
      }),
    ).toBe("runtime-id-1");
  });
});

describe("buildExtensionTelemetryProperties", () => {
  it("builds direct event and session metadata with install metadata", () => {
    expect(
      buildExtensionTelemetryProperties({
        versionMetadata,
        storage: null,
        createInstallId: () => "install-id-1",
      }),
    ).toEqual({
      ...versionMetadata,
      extensionInstallId: "install-id-1",
    });
  });

  it("normalizes missing version fields", () => {
    expect(
      buildExtensionTelemetryProperties({
        versionMetadata: {
          version: "",
          buildDate: " ",
          buildCommit: "-",
          buildBranch: "main",
          versionStamp: "0.21.0-2026-06-22",
        },
        storage: null,
        createInstallId: () => "install-id-1",
      }),
    ).toEqual({
      version: "-",
      buildDate: "-",
      buildCommit: "-",
      buildBranch: "main",
      versionStamp: "0.21.0-2026-06-22",
      extensionInstallId: "install-id-1",
    });
  });
});
