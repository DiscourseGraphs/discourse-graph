import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import discourseConfigRef from "~/utils/discourseConfigRef";
import { getSetting } from "~/utils/extensionSettings";
import { normalizeProps, type json } from "~/utils/getBlockProps";
import {
  getLeftSidebarPersonalSectionConfig,
  type LeftSidebarConfig,
} from "~/utils/getLeftSidebarSettings";
import { getVersionWithDate } from "~/utils/getVersion";
import {
  bulkReadSettings,
  deepEqual,
  readAllLegacyPersonalSettings,
  type SettingsSnapshot,
} from "./accessors";
import { PERSONAL_MIGRATION_MARKER } from "./migrationMarkers";
import {
  DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
  getPersonalSettingsKey,
  PersonalSettingsSchema,
} from "./zodSchema";

const LOG_PREFIX = "[DG Personal Settings Debug]";

const getMissingPaths = ({
  expected,
  stored,
  path = "",
}: {
  expected: unknown;
  stored: unknown;
  path?: string;
}): string[] => {
  if (stored === undefined) return [path];
  if (!expected || typeof expected !== "object") return [];
  return Object.entries(expected).flatMap(([key, value]) =>
    getMissingPaths({
      expected: value,
      stored:
        stored && typeof stored === "object"
          ? (stored as Record<string, unknown>)[key]
          : undefined,
      path: path ? `${path}.${key}` : key,
    }),
  );
};

export const logPersonalSettingsDebug = ({
  phase,
  snapshot,
  sidebarConfig,
}: {
  phase: string;
  snapshot?: SettingsSnapshot;
  sidebarConfig?: LeftSidebarConfig;
}): string | undefined => {
  try {
    const page = window.roamAlphaAPI.pull(
      "[:block/uid {:block/children [:block/uid :block/string :block/order :block/props :create/time]}]",
      [":node/title", DG_BLOCK_PROP_SETTINGS_PAGE_TITLE],
    ) as {
      ":block/uid"?: string;
      ":block/children"?: {
        ":block/uid": string;
        ":block/string": string;
        ":block/order"?: number;
        ":block/props"?: Record<string, json>;
        ":create/time"?: number;
      }[];
    } | null;
    const blocks = (page?.[":block/children"] ?? []).map((block) => ({
      uid: block[":block/uid"],
      text: block[":block/string"],
      order: block[":block/order"] ?? 0,
      props: normalizeProps(block[":block/props"] ?? {}) as Record<
        string,
        json
      >,
      createdAt: block[":create/time"],
    }));
    const userUid = window.roamAlphaAPI.user.uid() ?? "";
    const personalKey = getPersonalSettingsKey();
    const personalBlocks = blocks.filter((block) => block.text === personalKey);
    // bulkReadSettings uses the last matching block when duplicate labels exist.
    const personalProps = personalBlocks.at(-1)?.props ?? {};
    const featureFlags = blocks.filter(
      (block) => block.text === "Feature Flags",
    );
    const rawFlags = featureFlags.at(-1)?.props ?? {};
    const migratedV2 = getSetting<boolean>(PERSONAL_MIGRATION_MARKER, false);
    const legacy = readAllLegacyPersonalSettings();
    const defaults = PersonalSettingsSchema.parse({});
    const parsedProps = PersonalSettingsSchema.safeParse(personalProps);
    let effective = snapshot;
    let readError: string | undefined;
    try {
      effective ??= bulkReadSettings();
    } catch (error) {
      readError = String(error);
    }
    const propsEnabled =
      effective?.featureFlags["Use new settings store"] ??
      rawFlags["Use new settings store"] === true;
    const selectedSource =
      propsEnabled && migratedV2 === true ? "block props" : "legacy";
    const rows = Object.entries(defaults).map(([setting, schemaDefault]) => {
      const key = setting as keyof typeof defaults;
      const expectedRead =
        selectedSource === "legacy" ? legacy[key] : parsedProps.data?.[key];
      const actualRead = effective?.personalSettings[key];
      return {
        setting,
        selectedSource,
        missingFromProps: !Object.hasOwn(personalProps, key),
        differsFromLegacy: !deepEqual(legacy[key], parsedProps.data?.[key]),
        matchesExpectedRead: effective
          ? deepEqual(expectedRead, actualRead)
          : null,
        legacy: legacy[key],
        storedProps: personalProps[key],
        schemaDefault,
        expectedRead,
        actualRead,
      };
    });
    const rawPullFirstSidebarUid = blocks.find(
      (block) => block.text === "Left Sidebar",
    )?.uid;
    // Match the ordered tree used by refreshConfigTree, not Roam's pull order.
    const sidebarRoots = blocks
      .filter((block) => block.text === "Left Sidebar")
      .sort((a, b) => a.order - b.order)
      .map((block) => ({
        uid: block.uid,
        order: block.order,
        tree: getBasicTreeByParentUid(block.uid),
      }));
    const liveSidebarTree = sidebarRoots[0]?.tree ?? [];
    const cachedSidebarRoots = discourseConfigRef.tree.filter(
      (block) => block.text === "Left Sidebar",
    );
    const cachedSidebarRoot = cachedSidebarRoots[0];
    const cachedSidebarTree = cachedSidebarRoot?.children ?? [];
    const personalBlockMatcher = toFlexRegex(`${userUid}/Personal-Section`);
    const matchingPersonalBlocks = (
      tree: typeof liveSidebarTree,
    ): {
      uid: string;
      text: string;
      sections: { uid: string; text: string }[];
    }[] =>
      tree
        .filter((block) => personalBlockMatcher.test(block.text.trim()))
        .map((block) => ({
          uid: block.uid,
          text: block.text,
          sections: block.children.map(({ uid, text }) => ({ uid, text })),
        }));
    const sidebarSelection = {
      rawPullFirstSidebarUid,
      orderedLiveSidebarUid: sidebarRoots[0]?.uid,
      cachedSidebarUid: cachedSidebarRoot?.uid,
      liveRoots: sidebarRoots.map(({ uid, order, tree }) => ({
        uid,
        order,
        personalBlocks: matchingPersonalBlocks(tree),
      })),
      cachedRoots: cachedSidebarRoots.map(({ uid, children }) => ({
        uid,
        personalBlocks: matchingPersonalBlocks(children),
      })),
    };
    const livePersonal = getLeftSidebarPersonalSectionConfig(
      liveSidebarTree,
      userUid,
    );
    const cachedPersonal = getLeftSidebarPersonalSectionConfig(
      cachedSidebarTree,
      userUid,
    );
    const userKeys = new Set([
      userUid,
      ...liveSidebarTree
        .filter((block) => block.text.endsWith("/Personal-Section"))
        .map((block) => block.text.replace(/\/Personal-Section$/, "")),
      ...blocks
        .filter(
          (block) =>
            Object.hasOwn(block.props, "Left sidebar") &&
            block.text !== "Global",
        )
        .map((block) => block.text),
    ]);
    const users = [...userKeys].map((uid) => {
      const matches = blocks.filter((block) => block.text === uid);
      const sections = matches.at(-1)?.props["Left sidebar"];
      return {
        userUid: uid,
        currentUser: uid === userUid,
        legacySections: getLeftSidebarPersonalSectionConfig(
          liveSidebarTree,
          uid,
        ).sections.length,
        propsSections: Array.isArray(sections) ? sections.length : null,
        propsBlockUids: matches.map((block) => block.uid),
      };
    });
    const warnings: string[] = [];
    if (!page) warnings.push("Settings page is missing.");
    if (!userUid || personalKey !== userUid)
      warnings.push(
        "Current user UID and cached personal settings key are empty or different.",
      );
    if (personalBlocks.length !== 1)
      warnings.push(
        `Found ${personalBlocks.length} personal props blocks; expected one.`,
      );
    if (featureFlags.length !== 1)
      warnings.push(
        `Found ${featureFlags.length} Feature Flags blocks; expected one.`,
      );
    if (sidebarRoots.length !== 1)
      warnings.push(
        `Found ${sidebarRoots.length} Left Sidebar roots; legacy reads use the first by block order.`,
      );
    if (
      sidebarRoots[0]?.uid !== cachedSidebarRoot?.uid ||
      sidebarRoots.some(({ tree }) => matchingPersonalBlocks(tree).length > 1)
    )
      warnings.push(
        "Legacy sidebar selection is ambiguous or differs between the live graph and cache; inspect sidebar.selection.",
      );
    if (!parsedProps.success)
      warnings.push("Stored personal props fail schema validation.");
    if (!deepEqual(livePersonal, cachedPersonal))
      warnings.push(
        "Live legacy sidebar differs from the cached tree used by the legacy reader.",
      );
    if (
      livePersonal.sections.length &&
      !effective?.personalSettings["Left sidebar"].length
    )
      warnings.push(
        "Legacy personal sections exist, but the accessor returns none or failed.",
      );
    if (
      sidebarConfig &&
      !deepEqual(
        sidebarConfig.personal.sections.map((section) => section.text),
        effective?.personalSettings["Left sidebar"].map(
          (section) => section.name,
        ),
      )
    )
      warnings.push(
        "Sidebar config section names differ from the current accessor read.",
      );

    const report = {
      phase,
      capturedAt: new Date().toISOString(),
      graph: window.roamAlphaAPI.graph.name,
      version: getVersionWithDate(),
      userUid,
      personalKey,
      settingsPageUid: page?.[":block/uid"],
      selectedPersonalBlockUid: personalBlocks.at(-1)?.uid,
      propsEnabled,
      selectedSource,
      markers: {
        graph: blocks
          .filter((block) => block.text.startsWith("Block props migrated"))
          .map(({ text, uid, createdAt }) => ({ text, uid, createdAt })),
        personalV1: getSetting("dg-personal-settings-migrated", false),
        personalV2: migratedV2,
        propsDefaultMigrated: rawFlags["Props settings default migrated"],
        exactGraphV1: blocks.some(
          (block) => block.text === "Block props migrated",
        ),
        exactGraphV2: blocks.some(
          (block) => block.text === "Block props migrated v2",
        ),
      },
      warnings,
      readError,
      validationErrors: parsedProps.success ? [] : parsedProps.error.issues,
      missingPropPaths: getMissingPaths({
        expected: parsedProps.data ?? defaults,
        stored: personalProps,
      }),
      comparisons: rows,
      rawPersonalProps: personalProps,
      users,
      sidebar: {
        enabled: effective?.featureFlags["Enable left sidebar"],
        selection: sidebarSelection,
        liveLegacyPersonal: livePersonal,
        cachedLegacyPersonal: cachedPersonal,
        effectivePersonal: effective?.personalSettings["Left sidebar"],
        displayedConfig: sidebarConfig?.personal,
        wrapperPresent: Boolean(
          document.querySelector(".starred-pages-wrapper"),
        ),
        rootPresent: Boolean(document.querySelector("#dg-left-sidebar-root")),
      },
      comparisonNote:
        "Comparison rows use the cached legacy reader. Live sidebar and user counts use the first Left Sidebar root by block order; inspect sidebar.selection for duplicates. Neither copy proves the user's intended settings. Missing props may use schema defaults. Other users' extension settings are not inspected.",
    };
    // Freeze values at capture time; expanded DevTools objects otherwise show later mutations.
    const serialized = JSON.stringify(report, null, 2);
    console.groupCollapsed(
      `${LOG_PREFIX} ${report.graph} / ${userUid} / ${phase}`,
    );
    console.table(
      rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            typeof value === "object" ? JSON.stringify(value) : value,
          ]),
        ),
      ),
    );
    console.table(users);
    if (warnings.length) console.warn(LOG_PREFIX, warnings);
    console.log(`${LOG_PREFIX} report JSON`, serialized);
    console.groupEnd();
    return serialized;
  } catch (error) {
    console.warn(`${LOG_PREFIX} ${phase}: diagnostic failed`, error);
    return undefined;
  }
};
