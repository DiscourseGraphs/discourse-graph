import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoamBasicNode } from "roamjs-components/types";

const mocks = vi.hoisted(() => ({
  getBlockProps: vi.fn(),
  getShallowTreeByParentUid: vi.fn(),
  setBlockPropsAsync: vi.fn(),
  internalError: vi.fn(),
  migrateGraphLevel: vi.fn(),
  migratePersonalSettings: vi.fn(),
  migratePropsStoreDefault: vi.fn(),
}));

vi.mock("roamjs-components/queries/getPageUidByPageTitle", () => ({
  default: () => "settings-page",
}));
vi.mock("roamjs-components/queries/getShallowTreeByParentUid", () => ({
  default: mocks.getShallowTreeByParentUid,
}));
vi.mock("roamjs-components/writes", () => ({
  createPage: vi.fn(),
  createBlock: vi.fn(),
}));
vi.mock("~/utils/getBlockProps", () => ({ default: mocks.getBlockProps }));
vi.mock("~/utils/setBlockProps", () => ({
  setBlockPropsAsync: mocks.setBlockPropsAsync,
}));
vi.mock("~/utils/internalError", () => ({ default: mocks.internalError }));
vi.mock("~/utils/refreshConfigTree", () => ({ default: vi.fn() }));
vi.mock("~/utils/discourseConfigRef", () => ({
  default: { tree: [{ text: "grammar" }] },
}));
vi.mock("~/components/settings/utils/accessors", () => ({}));
vi.mock("~/components/settings/utils/migrateLegacyToBlockProps", () => ({
  migrateGraphLevel: mocks.migrateGraphLevel,
  migratePersonalSettings: mocks.migratePersonalSettings,
}));
vi.mock("~/components/settings/utils/migratePropsStoreDefault", () => ({
  migratePropsStoreDefault: mocks.migratePropsStoreDefault,
}));

import { initSchema } from "~/components/settings/utils/init";
import {
  FeatureFlagsSchema,
  GlobalSettingsSchema,
  PersonalSettingsSchema,
} from "~/components/settings/utils/zodSchema";
import DEFAULT_RELATIONS_BLOCK_PROPS from "~/components/settings/data/defaultRelationsBlockProps";

const block = (text: string, uid = text): RoamBasicNode => ({
  text,
  uid,
  children: [],
});

describe("settings initialization before migration", () => {
  let props: Record<string, Record<string, unknown>>;

  beforeEach(() => {
    vi.resetAllMocks();
    (globalThis as { window: unknown }).window = {
      roamAlphaAPI: { user: { uid: () => "user-uid" } },
    };
    const trees: Record<string, RoamBasicNode[]> = {
      "settings-page": [
        block("Feature Flags"),
        block("Global"),
        block("user-uid"),
        block("trigger"),
        block("grammar"),
        block("export"),
        block("Suggestive Mode"),
        block("Left Sidebar"),
      ],
      trigger: [block("\\")],
      grammar: [block("relations")],
      relations: [block("Informs", "real-relation-uid")],
      export: [block("max filename length")],
      "max filename length": [block("64")],
      "Suggestive Mode": [block("Page Groups")],
      "Left Sidebar": [block("Global-Section")],
      "Global-Section": [block("Children")],
    };
    mocks.getShallowTreeByParentUid.mockImplementation(
      (uid: string) => trees[uid] ?? [],
    );
    props = {
      "Feature Flags": FeatureFlagsSchema.parse({}),
      Global: GlobalSettingsSchema.parse({ Relations: {} }),
      "user-uid": PersonalSettingsSchema.parse({}),
    };
    mocks.getBlockProps.mockImplementation((uid: string) => props[uid]);
    mocks.setBlockPropsAsync.mockResolvedValue({});
    mocks.migrateGraphLevel.mockResolvedValue(true);
    mocks.migratePersonalSettings.mockResolvedValue(true);
    mocks.migratePropsStoreDefault.mockResolvedValue(undefined);
  });

  it.each(["Feature Flags", "Global", "user-uid", "relation reconciliation"])(
    "waits for %s writes before starting migration",
    async (section) => {
      if (section === "relation reconciliation") {
        props.Global.Relations = DEFAULT_RELATIONS_BLOCK_PROPS;
      } else {
        props[section] = {};
      }
      let finishWrite!: () => void;
      let pendingWrite = true;
      mocks.setBlockPropsAsync.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          finishWrite = () => {
            pendingWrite = false;
            resolve();
          };
        }),
      );
      mocks.migrateGraphLevel.mockImplementation(() => {
        expect(pendingWrite).toBe(false);
        return Promise.resolve(true);
      });

      const initialization = initSchema();
      await vi.waitFor(() =>
        expect(mocks.setBlockPropsAsync).toHaveBeenCalled(),
      );
      expect(mocks.migrateGraphLevel).not.toHaveBeenCalled();
      expect(mocks.migratePersonalSettings).not.toHaveBeenCalled();
      expect(mocks.migratePropsStoreDefault).not.toHaveBeenCalled();
      if (section === "relation reconciliation") {
        const expectedRelations = { ...DEFAULT_RELATIONS_BLOCK_PROPS };
        delete expectedRelations["_INFO-rel"];
        expectedRelations["real-relation-uid"] =
          DEFAULT_RELATIONS_BLOCK_PROPS["_INFO-rel"];
        expect(mocks.setBlockPropsAsync).toHaveBeenCalledWith(
          "Global",
          { Relations: expectedRelations },
          false,
        );
      }

      finishWrite();
      await initialization;

      expect(mocks.migrateGraphLevel).toHaveBeenCalledOnce();
      expect(mocks.migratePersonalSettings).toHaveBeenCalledOnce();
      expect(mocks.migratePropsStoreDefault).toHaveBeenCalledOnce();
    },
  );

  it.each(["defaults", "relation reconciliation"])(
    "skips migration after a failed %s save and retries on the next load",
    async (section) => {
      if (section === "defaults") props["user-uid"] = {};
      else props.Global.Relations = DEFAULT_RELATIONS_BLOCK_PROPS;
      const error = new Error("save failed");
      mocks.setBlockPropsAsync.mockRejectedValueOnce(error);

      const result = await initSchema();

      expect(result.blockUids["user-uid"]).toBe("user-uid");
      expect(mocks.internalError).toHaveBeenCalledWith(
        expect.objectContaining({
          error,
          type: "DG Block Props Initialization",
        }),
      );
      expect(mocks.migrateGraphLevel).not.toHaveBeenCalled();
      expect(mocks.migratePersonalSettings).not.toHaveBeenCalled();
      expect(mocks.migratePropsStoreDefault).not.toHaveBeenCalled();

      await initSchema();

      expect(mocks.migratePropsStoreDefault).toHaveBeenCalledOnce();
    },
  );
});
