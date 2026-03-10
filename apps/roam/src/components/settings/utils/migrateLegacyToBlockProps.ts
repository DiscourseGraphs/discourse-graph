import getBlockProps from "~/utils/getBlockProps";
import type { json } from "~/utils/getBlockProps";
import setBlockProps from "~/utils/setBlockProps";
import getBlockUidByTextOnPage from "roamjs-components/queries/getBlockUidByTextOnPage";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { createBlock } from "roamjs-components/writes";
import { getSetting, setSetting } from "~/utils/extensionSettings";
import {
  readAllLegacyFeatureFlags,
  readAllLegacyGlobalSettings,
  readAllLegacyPersonalSettings,
  readAllLegacyDiscourseNodeSettings,
} from "./accessors";
import {
  FeatureFlagsSchema,
  GlobalSettingsSchema,
  PersonalSettingsSchema,
  DiscourseNodeSchema,
  DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
  DISCOURSE_NODE_PAGE_PREFIX,
  TOP_LEVEL_BLOCK_PROP_KEYS,
  getPersonalSettingsKey,
} from "./zodSchema";
import type { z } from "zod";

const LOG_PREFIX = "[DG BlockProps Migration]";
const GRAPH_MIGRATION_MARKER = "Block props migrated";
const PERSONAL_MIGRATION_MARKER = "dg-personal-settings-migrated";

const hasGraphMigrationMarker = (): boolean =>
  !!getBlockUidByTextOnPage({
    text: GRAPH_MIGRATION_MARKER,
    title: DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
  });

const isPropsValid = (
  schema: z.ZodTypeAny,
  props: Record<string, json> | null,
): boolean =>
  !!props && Object.keys(props).length > 0 && schema.safeParse(props).success;

const shouldWrite = (
  schema: z.ZodTypeAny,
  currentProps: Record<string, json> | null,
  parsedLegacy: Record<string, json>,
): boolean => {
  if (!isPropsValid(schema, currentProps)) {
    return true;
  }

  // safeParse because some schemas (DiscourseNodeSchema) have required fields
  // with no defaults, so parse({}) would throw.
  const defaultsResult = schema.safeParse({});
  if (!defaultsResult.success) {
    // Can't determine schema defaults (e.g. DiscourseNodeSchema).
    // Compare Zod-normalized parsed legacy against current props directly.
    // Both sides are normalized so the comparison is apples-to-apples.
    // Safe on retry: if prior run already wrote parsedLegacy, they'll match
    // → skip. If user edited via settings UI, dual-write keeps both sides in
    // sync → match → skip. The only write happens when legacy genuinely
    // differs from current (first migration or tree-only edit).
    return JSON.stringify(parsedLegacy) !== JSON.stringify(currentProps);
  }

  const defaults = defaultsResult.data as Record<string, unknown>;
  const propsMatch = JSON.stringify(currentProps) === JSON.stringify(defaults);
  const legacyDiffers =
    JSON.stringify(parsedLegacy) !== JSON.stringify(defaults);

  return propsMatch && legacyDiffers;
};

const migrateSection = ({
  label,
  blockUid,
  schema,
  legacyData,
}: {
  label: string;
  blockUid: string;
  schema: z.ZodTypeAny;
  legacyData: Record<string, unknown>;
}): boolean => {
  const currentProps = getBlockProps(blockUid);

  const parseResult = schema.safeParse(legacyData);
  if (!parseResult.success) {
    // Legacy malformed — succeed if current props are already valid.
    // migrateGraphLevel runs before initDiscourseNodePages, so valid props
    // at this point were written by a prior migration run, not init-seeded.
    if (isPropsValid(schema, currentProps)) {
      console.log(
        `${LOG_PREFIX} ${label}: legacy malformed but props already valid, skipping`,
      );
      return true;
    }
    console.warn(`${LOG_PREFIX} ${label}: Zod validation failed, skipping`, {
      error: parseResult.error.message,
    });
    return false;
  }

  const parsedLegacy = parseResult.data as Record<string, json>;
  if (!shouldWrite(schema, currentProps, parsedLegacy)) {
    console.log(`${LOG_PREFIX} ${label}: props already non-default, skipping`);
    return true;
  }

  setBlockProps(blockUid, parsedLegacy, false);
  console.log(`${LOG_PREFIX} ${label}: migrated`);
  return true;
};

const migrateDiscourseNodes = (): boolean => {
  const nodePages = window.roamAlphaAPI.data.fast.q(`
    [:find ?uid ?title
     :where
     [?page :node/title ?title]
     [?page :block/uid ?uid]
     [(clojure.string/starts-with? ?title "${DISCOURSE_NODE_PAGE_PREFIX}")]]
  `) as [string, string][];

  let allOk = true;

  for (const [nodePageUid, title] of nodePages) {
    if (typeof nodePageUid !== "string" || typeof title !== "string") continue;

    const nodeText = title.replace(DISCOURSE_NODE_PAGE_PREFIX, "");
    const legacyData = readAllLegacyDiscourseNodeSettings(
      nodePageUid,
      nodeText,
    );
    if (!legacyData) {
      // Legacy unreadable — if current props are already valid, treat as
      // success so a missing/malformed legacy tree doesn't block the marker.
      if (isPropsValid(DiscourseNodeSchema, getBlockProps(nodePageUid))) {
        console.log(
          `${LOG_PREFIX} Discourse Node (${nodeText}): legacy unreadable but props already valid, skipping`,
        );
        continue;
      }
      console.warn(
        `${LOG_PREFIX} Discourse Node (${nodeText}): legacy data unreadable`,
      );
      allOk = false;
      continue;
    }

    if (
      !migrateSection({
        label: `Discourse Node (${nodeText})`,
        blockUid: nodePageUid,
        schema: DiscourseNodeSchema,
        legacyData,
      })
    ) {
      allOk = false;
    }
  }

  return allOk;
};

export const migrateGraphLevel = async (
  blockUids: Record<string, string>,
): Promise<void> => {
  const pageUid = getPageUidByPageTitle(DG_BLOCK_PROP_SETTINGS_PAGE_TITLE);
  if (!pageUid) return;

  if (hasGraphMigrationMarker()) {
    console.log(`${LOG_PREFIX} graph-level: skipped (already migrated)`);
    return;
  }

  let failures = 0;

  // Feature flags
  const featureFlagUid = blockUids[TOP_LEVEL_BLOCK_PROP_KEYS.featureFlags];
  if (featureFlagUid) {
    const legacyFlags = readAllLegacyFeatureFlags();
    if (
      !migrateSection({
        label: "Feature Flags",
        blockUid: featureFlagUid,
        schema: FeatureFlagsSchema,
        legacyData: legacyFlags as Record<string, unknown>,
      })
    ) {
      failures++;
    }
  }

  // Global settings
  const globalUid = blockUids[TOP_LEVEL_BLOCK_PROP_KEYS.global];
  if (globalUid) {
    const legacyGlobal = readAllLegacyGlobalSettings();
    if (
      !migrateSection({
        label: "Global",
        blockUid: globalUid,
        schema: GlobalSettingsSchema,
        legacyData: legacyGlobal,
      })
    ) {
      failures++;
    }
  }

  // Discourse nodes
  if (!migrateDiscourseNodes()) {
    failures++;
  }

  if (failures === 0) {
    try {
      await createBlock({
        parentUid: pageUid,
        node: { text: GRAPH_MIGRATION_MARKER },
      });
      console.log(`${LOG_PREFIX} graph-level: completed`);
    } catch (e) {
      console.warn(
        `${LOG_PREFIX} graph-level: data migrated but marker write failed (will retry next load)`,
        e,
      );
    }
  } else {
    console.warn(
      `${LOG_PREFIX} graph-level: ${failures} section(s) failed, marker not created (will retry next load)`,
    );
  }
};

export const migratePersonalSettings = async (
  blockUids: Record<string, string>,
): Promise<void> => {
  if (getSetting<boolean>(PERSONAL_MIGRATION_MARKER, false)) {
    console.log(`${LOG_PREFIX} personal: skipped (already migrated)`);
    return;
  }

  const personalKey = getPersonalSettingsKey();
  const personalUid = blockUids[personalKey];
  if (!personalUid) return;

  const legacyPersonal = readAllLegacyPersonalSettings();
  const ok = migrateSection({
    label: "Personal",
    blockUid: personalUid,
    schema: PersonalSettingsSchema,
    legacyData: legacyPersonal,
  });

  if (ok) {
    try {
      await setSetting(PERSONAL_MIGRATION_MARKER, true);
      console.log(`${LOG_PREFIX} personal: completed`);
    } catch (e) {
      console.warn(
        `${LOG_PREFIX} personal: data migrated but marker write failed (will retry next load)`,
        e,
      );
    }
  } else {
    console.warn(
      `${LOG_PREFIX} personal: failed, marker not created (will retry next load)`,
    );
  }
};
