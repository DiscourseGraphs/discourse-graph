import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/utils/internalError", () => ({ default: vi.fn() }));
vi.mock("~/utils/extensionSettings", () => ({ getSetting: vi.fn() }));
vi.mock("~/utils/parseQuery", () => ({ roamNodeToCondition: vi.fn() }));
vi.mock("~/utils/getDiscourseNodes", () => ({ default: vi.fn() }));
vi.mock("roamjs-components/queries/getBasicTreeByParentUid", () => ({
  default: () => [],
}));

import { getSetting } from "~/utils/extensionSettings";
import {
  bulkReadSettings,
  getPersonalSetting,
} from "~/components/settings/utils/accessors";
import { PERSONAL_MIGRATION_MARKER } from "~/components/settings/utils/migrationMarkers";
import { PERSONAL_KEYS } from "~/components/settings/utils/settingKeys";

describe("personal settings migration readiness", () => {
  let currentUser: string;
  let propsEnabled: boolean;
  let includePersonalBlock: boolean;
  let migratedUsers: Set<string>;

  beforeEach(() => {
    currentUser = "user-a";
    propsEnabled = true;
    includePersonalBlock = true;
    migratedUsers = new Set(["user-a"]);
    vi.mocked(getSetting).mockImplementation((key, defaultValue) => {
      if (key === PERSONAL_MIGRATION_MARKER) {
        return migratedUsers.has(currentUser);
      }
      // The old marker cannot prove the previous fire-and-forget writes succeeded.
      if (key === "dg-personal-settings-migrated") return true;
      if (key === "disallow-diagnostics") return true;
      return defaultValue;
    });
    (globalThis as { window: unknown }).window = {
      roamAlphaAPI: {
        user: { uid: () => currentUser },
        pull: () => ({
          ":block/children": [
            {
              ":block/string": "Feature Flags",
              ":block/props": { "Use new settings store": propsEnabled },
            },
            {
              ":block/string": "Global",
              ":block/props": { Trigger: "props-trigger" },
            },
            ...(includePersonalBlock
              ? [
                  {
                    ":block/string": currentUser,
                    ":block/props": { "Disable product diagnostics": false },
                  },
                ]
              : []),
          ],
        }),
      },
    };
  });

  it.each([true, false])(
    "preserves a collaborator's startup opt-out before migration (personal block exists: %s)",
    (hasPersonalBlock) => {
      expect(
        bulkReadSettings().personalSettings[
          PERSONAL_KEYS.disableProductDiagnostics
        ],
      ).toBe(false);

      currentUser = "user-b";
      includePersonalBlock = hasPersonalBlock;
      const settings = bulkReadSettings();

      expect(settings.featureFlags["Use new settings store"]).toBe(true);
      expect(settings.globalSettings.Trigger).toBe("props-trigger");
      expect(
        settings.personalSettings[PERSONAL_KEYS.disableProductDiagnostics],
      ).toBe(true);
      expect(
        getPersonalSetting([PERSONAL_KEYS.disableProductDiagnostics]),
      ).toBe(true);
    },
  );

  it("switches to personal props only after that user's migration succeeds", () => {
    currentUser = "user-b";
    expect(getPersonalSetting([PERSONAL_KEYS.disableProductDiagnostics])).toBe(
      true,
    );

    migratedUsers.add(currentUser);

    expect(getPersonalSetting([PERSONAL_KEYS.disableProductDiagnostics])).toBe(
      false,
    );
  });

  it("honors an admin rollback even after personal migration", () => {
    propsEnabled = false;

    expect(getPersonalSetting([PERSONAL_KEYS.disableProductDiagnostics])).toBe(
      true,
    );
  });
});
