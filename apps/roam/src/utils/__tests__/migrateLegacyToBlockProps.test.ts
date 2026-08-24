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
  getSetting: vi.fn(),
  setSetting: vi.fn(),
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
  getSetting: mocks.getSetting,
  setSetting: mocks.setSetting,
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

import {
  migrateGraphLevel,
  migratePersonalSettings,
} from "~/components/settings/utils/migrateLegacyToBlockProps";
import {
  FeatureFlagsSchema,
  GlobalSettingsSchema,
} from "~/components/settings/utils/zodSchema";

describe("legacy settings migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPageUidByPageTitle.mockReturnValue("settings-page-uid");
    mocks.readAllLegacyFeatureFlags.mockReturnValue({});
    mocks.readAllLegacyGlobalSettings.mockReturnValue({});
    mocks.readAllLegacyPersonalSettings.mockReturnValue({});
    mocks.getBlockProps.mockImplementation((uid: string) =>
      uid === "feature-flags-uid" ? FeatureFlagsSchema.parse({}) : {},
    );
    mocks.setBlockPropsAsync.mockResolvedValue({});
    mocks.setSetting.mockResolvedValue(undefined);
    (globalThis as { window: unknown }).window = {
      roamAlphaAPI: {
        data: { async: { fast: { q: vi.fn().mockResolvedValue([]) } } },
        user: { uid: () => "user-uid" },
      },
    };
  });

  it("revalidates an old graph marker and does not complete when a write fails", async () => {
    mocks.setBlockPropsAsync.mockRejectedValue(new Error("write failed"));

    const migrated = await migrateGraphLevel({
      "Block props migrated": "old-marker-uid",
      "Feature Flags": "feature-flags-uid",
      Global: "global-uid",
    });

    expect(migrated).toBe(false);
    expect(mocks.createBlock).not.toHaveBeenCalled();
    expect(mocks.internalError).toHaveBeenCalledWith(
      expect.objectContaining({ type: "DG Block Props Migration" }),
    );
  });

  it("records a versioned graph marker after revalidating an old marker", async () => {
    const migrated = await migrateGraphLevel({
      "Block props migrated": "old-marker-uid",
      "Feature Flags": "feature-flags-uid",
      Global: "global-uid",
    });

    expect(migrated).toBe(true);
    expect(mocks.createBlock).toHaveBeenCalledWith({
      parentUid: "settings-page-uid",
      node: { text: "Block props migrated v2" },
    });
  });

  it("rejects malformed legacy data even when current props are valid", async () => {
    mocks.readAllLegacyGlobalSettings.mockReturnValue({ Trigger: 123 });
    mocks.getBlockProps.mockImplementation((uid: string) => {
      if (uid === "feature-flags-uid") return FeatureFlagsSchema.parse({});
      if (uid === "global-uid") return GlobalSettingsSchema.parse({});
      return {};
    });

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

  it("uses a versioned personal marker before enabling props", async () => {
    mocks.getSetting.mockReturnValue(false);

    const migrated = await migratePersonalSettings({
      "user-uid": "personal-settings-uid",
    });

    expect(migrated).toBe(true);
    expect(mocks.getSetting).toHaveBeenCalledWith(
      "dg-personal-settings-migrated-v2",
      false,
    );
    expect(mocks.setSetting).toHaveBeenCalledWith(
      "dg-personal-settings-migrated-v2",
      true,
    );
  });
});
