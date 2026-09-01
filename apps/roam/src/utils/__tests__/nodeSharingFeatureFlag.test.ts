import { describe, expect, it, vi } from "vitest";

vi.mock("~/utils/internalError", () => ({ default: vi.fn() }));
vi.mock("~/utils/extensionSettings", () => ({ getSetting: vi.fn() }));
vi.mock("~/utils/parseQuery", () => ({ roamNodeToCondition: vi.fn() }));

// Runs before the imports below: getDiscourseNodes calls generateUID at module load.
vi.hoisted(() => {
  (globalThis as { window?: unknown }).window = {
    roamAlphaAPI: { util: { generateUID: () => "someUid" } },
  };
});

import {
  isNodeSharingEnabled,
  isSyncEnabled,
} from "~/components/settings/utils/accessors";

const seedWindow = (featureFlags: Record<string, boolean>) => {
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: {
      user: { uid: () => "user-1" },
      util: { generateUID: () => "someUid" },
      pull: () => ({
        ":block/children": [
          {
            ":block/string": "Feature Flags",
            ":block/props": {
              "Use new settings store": true,
              ...featureFlags,
            },
          },
        ],
      }),
    },
  };
};

describe("node sharing feature flag", () => {
  it("defaults to disabled alongside suggestive mode", () => {
    seedWindow({});
    expect(isNodeSharingEnabled()).toBe(false);
    expect(isSyncEnabled()).toBe(false);
  });

  it("enables node sharing without suggestive mode", () => {
    seedWindow({ "Enable node sharing": true });
    expect(isNodeSharingEnabled()).toBe(true);
    expect(isSyncEnabled()).toBe(false);
  });

  it("does not enable node sharing when only suggestive mode is on", () => {
    seedWindow({ "Suggestive mode overlay enabled": true });
    expect(isNodeSharingEnabled()).toBe(false);
    expect(isSyncEnabled()).toBe(true);
  });
});
