import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createBlock: vi.fn(),
  getBlockProps: vi.fn(),
  getPageUidByPageTitle: vi.fn(),
  internalError: vi.fn(),
  invalidateDiscourseNodeTypeCaches: vi.fn(),
  readAllLegacyDiscourseNodeSettings: vi.fn(),
  readAllLegacyFeatureFlags: vi.fn(),
  readAllLegacyGlobalSettings: vi.fn(),
  readAllLegacyPersonalSettings: vi.fn(),
  setBlockPropsAsync: vi.fn(),
}));

vi.mock("roamjs-components/queries/getPageUidByPageTitle", () => ({
  default: mocks.getPageUidByPageTitle,
}));
vi.mock("roamjs-components/writes", () => ({
  createBlock: mocks.createBlock,
}));
vi.mock("~/utils/getBlockProps", () => ({
  default: mocks.getBlockProps,
}));
vi.mock("~/utils/setBlockProps", () => ({
  setBlockPropsAsync: mocks.setBlockPropsAsync,
}));
vi.mock("~/utils/extensionSettings", () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}));
vi.mock("~/utils/internalError", () => ({
  default: mocks.internalError,
}));
vi.mock("~/utils/discourseNodeTypeCache", () => ({
  invalidateDiscourseNodeTypeCaches: mocks.invalidateDiscourseNodeTypeCaches,
}));
vi.mock("~/components/settings/utils/accessors", () => ({
  LEGACY_SOURCED_FEATURE_FLAG_KEYS: ["Enable left sidebar"],
  readAllLegacyDiscourseNodeSettings: mocks.readAllLegacyDiscourseNodeSettings,
  readAllLegacyFeatureFlags: mocks.readAllLegacyFeatureFlags,
  readAllLegacyGlobalSettings: mocks.readAllLegacyGlobalSettings,
  readAllLegacyPersonalSettings: mocks.readAllLegacyPersonalSettings,
}));

import { migrateGraphLevel } from "~/components/settings/utils/migrateLegacyToBlockProps";
import { FeatureFlagsSchema } from "~/components/settings/utils/zodSchema";

describe("legacy settings migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPageUidByPageTitle.mockReturnValue("settings-page-uid");
    mocks.readAllLegacyFeatureFlags.mockReturnValue({});
    mocks.readAllLegacyGlobalSettings.mockReturnValue({});
    mocks.getBlockProps.mockImplementation((uid: string) =>
      uid === "feature-flags-uid" ? FeatureFlagsSchema.parse({}) : {},
    );
    (globalThis as { window: unknown }).window = {
      roamAlphaAPI: {
        data: { async: { fast: { q: vi.fn().mockResolvedValue([]) } } },
      },
    };
  });

  it("does not record migration completion when a props write fails", async () => {
    mocks.setBlockPropsAsync.mockRejectedValue(new Error("write failed"));

    const migrated = await migrateGraphLevel({
      "Feature Flags": "feature-flags-uid",
      Global: "global-uid",
    });

    expect(migrated).toBe(false);
    expect(mocks.createBlock).not.toHaveBeenCalled();
    expect(mocks.internalError).toHaveBeenCalledWith(
      expect.objectContaining({ type: "DG Block Props Migration" }),
    );
  });
});
