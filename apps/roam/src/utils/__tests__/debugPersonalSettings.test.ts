import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoamBasicNode } from "roamjs-components/types";

vi.mock("~/utils/internalError", () => ({ default: vi.fn() }));
vi.mock("~/utils/extensionSettings", () => ({ getSetting: vi.fn() }));
vi.mock("~/utils/parseQuery", () => ({ roamNodeToCondition: vi.fn() }));
vi.mock("~/utils/getDiscourseNodes", () => ({ default: vi.fn() }));
vi.mock("roamjs-components/queries/getBasicTreeByParentUid", () => ({
  default: vi.fn(),
}));

import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import discourseConfigRef from "~/utils/discourseConfigRef";
import { getSetting } from "~/utils/extensionSettings";
import { logPersonalSettingsDebug } from "~/components/settings/utils/debugPersonalSettings";
import { PERSONAL_MIGRATION_MARKER } from "~/components/settings/utils/migrationMarkers";
import {
  getPersonalSettingsKey,
  PersonalSettingsSchema,
} from "~/components/settings/utils/zodSchema";

describe("personal settings debug reports", () => {
  let propsEnabled: boolean;
  let migratedV2: boolean;
  let personalProps: Record<string, unknown>;
  let additionalBlocks: Record<string, unknown>[];
  let liveSidebar: RoamBasicNode[];

  beforeEach(() => {
    vi.restoreAllMocks();
    for (const method of [
      "groupCollapsed",
      "groupEnd",
      "table",
      "log",
      "warn",
    ] as const) {
      vi.spyOn(console, method).mockImplementation(() => undefined);
    }
    propsEnabled = true;
    migratedV2 = true;
    personalProps = {};
    additionalBlocks = [];
    liveSidebar = [
      {
        uid: "legacy-personal",
        text: "user-a/Personal-Section",
        children: [{ uid: "research", text: "My research", children: [] }],
      },
    ];
    discourseConfigRef.tree = [
      { uid: "sidebar", text: "Left Sidebar", children: liveSidebar },
    ];
    vi.mocked(getBasicTreeByParentUid).mockImplementation(() => liveSidebar);
    vi.mocked(getSetting).mockImplementation((key, fallback) => {
      if (key === PERSONAL_MIGRATION_MARKER) return migratedV2;
      if (key === "dg-personal-settings-migrated") return true;
      return fallback;
    });
    vi.stubGlobal("window", {
      roamAlphaAPI: {
        graph: { name: "test-graph" },
        user: { uid: () => "user-a" },
        pull: () => ({
          ":block/uid": "settings-page",
          ":block/children": [
            {
              ":block/uid": "flags",
              ":block/string": "Feature Flags",
              ":block/props": {
                "Use new settings store": propsEnabled,
                "Enable left sidebar": true,
              },
            },
            {
              ":block/uid": "sidebar",
              ":block/string": "Left Sidebar",
              ":block/order": 10,
            },
            {
              ":block/uid": "personal",
              ":block/string": "user-a",
              ":block/props": personalProps,
            },
            ...additionalBlocks,
          ],
        }),
      },
    });
    vi.stubGlobal("document", { querySelector: () => null });
  });

  it("exposes sections hidden by empty props without changing either store", () => {
    const before = JSON.stringify(discourseConfigRef.tree);
    const result = logPersonalSettingsDebug({ phase: "test" });
    expect(result).toBeDefined();
    const report = JSON.parse(result!) as Record<string, unknown>;
    expect(report).toMatchObject({
      graph: "test-graph",
      userUid: "user-a",
      selectedSource: "block props",
      selectedPersonalBlockUid: "personal",
      users: [{ userUid: "user-a", legacySections: 1, propsSections: null }],
    });
    expect(report.comparisons).toHaveLength(
      Object.keys(PersonalSettingsSchema.shape).length,
    );
    expect(report.comparisons).toContainEqual(
      expect.objectContaining({
        setting: "Left sidebar",
        missingFromProps: true,
        differsFromLegacy: true,
        matchesExpectedRead: true,
        actualRead: [],
      }),
    );
    expect(report.warnings).toContain(
      "Legacy personal sections exist, but the accessor returns none or failed.",
    );
    expect(report.missingPropPaths).toContain("Left sidebar");
    expect(personalProps).toEqual({});
    expect(JSON.stringify(discourseConfigRef.tree)).toBe(before);
  });

  it.each(["rollback", "personal migration pending"])(
    "reports legacy reads for %s",
    (reason) => {
      propsEnabled = reason !== "rollback";
      migratedV2 = reason !== "personal migration pending";
      const report = JSON.parse(
        logPersonalSettingsDebug({ phase: "test" })!,
      ) as Record<string, unknown>;
      expect(report.selectedSource).toBe("legacy");
      expect(report.comparisons).toContainEqual(
        expect.objectContaining({
          setting: "Left sidebar",
          missingFromProps: true,
          matchesExpectedRead: true,
          actualRead: [expect.objectContaining({ name: "My research" })],
        }),
      );
      expect(report.warnings).not.toContain(
        "Legacy personal sections exist, but the accessor returns none or failed.",
      );
    },
  );

  it("distinguishes missing nested props from values supplied by defaults", () => {
    personalProps = { Query: { "Hide query metadata": false } };
    const report = JSON.parse(
      logPersonalSettingsDebug({ phase: "test" })!,
    ) as Record<string, unknown>;
    expect(report.missingPropPaths).toContain("Query.Default page size");
    expect(report.missingPropPaths).not.toContain("Query.Hide query metadata");
    expect(report.comparisons).toContainEqual(
      expect.objectContaining({
        setting: "Query",
        missingFromProps: false,
        storedProps: { "Hide query metadata": false },
        actualRead: {
          "Hide query metadata": false,
          "Default page size": 10,
          "Query pages": ["discourse-graph/queries/*"],
          "Default filters": {},
        },
      }),
    );
  });

  it("keeps reporting when malformed props make the real accessor throw", () => {
    personalProps = { "Left sidebar": "invalid" };
    const report = JSON.parse(
      logPersonalSettingsDebug({ phase: "test" })!,
    ) as Record<string, unknown>;
    expect(report.readError).toContain("Left sidebar");
    expect(report.validationErrors).toContainEqual(
      expect.objectContaining({ path: ["Left sidebar"] }),
    );
    expect(report.comparisons).toContainEqual(
      expect.objectContaining({
        setting: "Left sidebar",
        matchesExpectedRead: null,
      }),
    );
  });

  it("reports duplicate blocks and the last block actually selected by the accessor", () => {
    additionalBlocks = [
      {
        ":block/uid": "duplicate-personal",
        ":block/string": "user-a",
        ":block/props": { "Left sidebar": [{ name: "From duplicate" }] },
      },
    ];
    const report = JSON.parse(
      logPersonalSettingsDebug({ phase: "test" })!,
    ) as Record<string, unknown>;
    expect(report.selectedPersonalBlockUid).toBe("duplicate-personal");
    expect(report.warnings).toContain(
      "Found 2 personal props blocks; expected one.",
    );
    expect(report.comparisons).toContainEqual(
      expect.objectContaining({
        setting: "Left sidebar",
        actualRead: [expect.objectContaining({ name: "From duplicate" })],
      }),
    );
  });

  it("reports live versus cached sidebar differences and collaborator counts", () => {
    liveSidebar = [
      ...liveSidebar,
      {
        uid: "other",
        text: "user-b/Personal-Section",
        children: [
          { uid: "other-section", text: "Other research", children: [] },
        ],
      },
    ];
    discourseConfigRef.tree = [];
    const report = JSON.parse(
      logPersonalSettingsDebug({ phase: "test" })!,
    ) as Record<string, unknown>;
    expect(report.warnings).toContain(
      "Live legacy sidebar differs from the cached tree used by the legacy reader.",
    );
    expect(report.users).toContainEqual(
      expect.objectContaining({
        userUid: "user-b",
        legacySections: 1,
        propsSections: null,
      }),
    );
  });

  it("identifies a cached user key that no longer matches the current graph session", () => {
    expect(getPersonalSettingsKey()).toBe("user-a");
    window.roamAlphaAPI.user.uid = () => "user-b";
    window.roamAlphaAPI.graph.name = "second-graph";
    const report = JSON.parse(
      logPersonalSettingsDebug({ phase: "test" })!,
    ) as Record<string, unknown>;
    expect(report).toMatchObject({
      graph: "second-graph",
      userUid: "user-b",
      personalKey: "user-a",
    });
    expect(report.warnings).toContain(
      "Current user UID and cached personal settings key are empty or different.",
    );
  });

  it("does not mistake unordered duplicate sidebar roots for a stale cache", () => {
    additionalBlocks = [
      {
        ":block/uid": "ordered-first-sidebar",
        ":block/string": "Left Sidebar",
        ":block/order": 0,
      },
    ];
    const otherPersonal: RoamBasicNode[] = [
      {
        uid: "other-personal",
        text: "user-a/Personal-Section",
        children: [
          { uid: "other-section", text: "Other section", children: [] },
        ],
      },
    ];
    vi.mocked(getBasicTreeByParentUid).mockImplementation((uid) =>
      uid === "sidebar" ? otherPersonal : liveSidebar,
    );
    discourseConfigRef.tree = [
      {
        uid: "ordered-first-sidebar",
        text: "Left Sidebar",
        children: liveSidebar,
      },
      { uid: "sidebar", text: "Left Sidebar", children: otherPersonal },
    ];
    const report = JSON.parse(
      logPersonalSettingsDebug({ phase: "test" })!,
    ) as Record<string, unknown>;
    expect(report.sidebar).toMatchObject({
      selection: {
        rawPullFirstSidebarUid: "sidebar",
        orderedLiveSidebarUid: "ordered-first-sidebar",
        cachedSidebarUid: "ordered-first-sidebar",
        liveRoots: [
          {
            uid: "ordered-first-sidebar",
            order: 0,
            personalBlocks: [{ uid: "legacy-personal" }],
          },
          {
            uid: "sidebar",
            order: 10,
            personalBlocks: [{ uid: "other-personal" }],
          },
        ],
      },
      liveLegacyPersonal: { uid: "legacy-personal" },
      cachedLegacyPersonal: { uid: "legacy-personal" },
    });
    expect(report.warnings).toContain(
      "Found 2 Left Sidebar roots; legacy reads use the first by block order.",
    );
    expect(report.warnings).not.toContain(
      "Live legacy sidebar differs from the cached tree used by the legacy reader.",
    );
  });

  it("reports duplicate personal blocks and distinguishes renamed migration markers", () => {
    liveSidebar.push({
      uid: "second-personal",
      text: "user-a/Personal-Section",
      children: [],
    });
    additionalBlocks = [
      { ":block/uid": "renamed-v1", ":block/string": "Block props migrated s" },
      { ":block/uid": "v2", ":block/string": "Block props migrated v2" },
    ];
    const report = JSON.parse(
      logPersonalSettingsDebug({ phase: "test" })!,
    ) as Record<string, unknown>;
    expect(report.markers).toMatchObject({
      exactGraphV1: false,
      exactGraphV2: true,
    });
    expect(report.sidebar).toMatchObject({
      selection: {
        liveRoots: [
          {
            personalBlocks: [
              { uid: "legacy-personal" },
              { uid: "second-personal" },
            ],
          },
        ],
      },
    });
    expect(report.warnings).toContain(
      "Legacy sidebar selection is ambiguous or differs between the live graph and cache; inspect sidebar.selection.",
    );
  });
});
