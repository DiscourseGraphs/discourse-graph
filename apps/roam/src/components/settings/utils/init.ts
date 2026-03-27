import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import { createPage, createBlock } from "roamjs-components/writes";
import setBlockProps from "~/utils/setBlockProps";
import getBlockProps from "~/utils/getBlockProps";
import type { json } from "~/utils/getBlockProps";
import INITIAL_NODE_VALUES from "~/data/defaultDiscourseNodes";
import DEFAULT_RELATION_VALUES from "~/data/defaultDiscourseRelations";
import DEFAULT_RELATIONS_BLOCK_PROPS from "~/components/settings/data/defaultRelationsBlockProps";
import {
  getAllDiscourseNodes,
  isNewSettingsStoreEnabled,
  getFeatureFlags,
  getGlobalSettings,
  getPersonalSettings,
  getDiscourseNodeSettings,
  readAllLegacyFeatureFlags,
  readAllLegacyGlobalSettings,
  readAllLegacyPersonalSettings,
  readAllLegacyDiscourseNodeSettings,
} from "./accessors";
import {
  migrateGraphLevel,
  migratePersonalSettings,
} from "./migrateLegacyToBlockProps";
import {
  DiscourseNodeSchema,
  getTopLevelBlockPropsConfig,
} from "~/components/settings/utils/zodSchema";
import {
  DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
  DISCOURSE_NODE_PAGE_PREFIX,
} from "./zodSchema";
import toFlexRegex from "roamjs-components/util/toFlexRegex";

const ensurePageExists = async (pageTitle: string): Promise<string> => {
  let pageUid = getPageUidByPageTitle(pageTitle);

  if (!pageUid) {
    pageUid = window.roamAlphaAPI.util.generateUID();
    await createPage({
      title: pageTitle,
      uid: pageUid,
    });
  }

  return pageUid;
};

const ensureBlocksExist = async (
  pageUid: string,
  blockTexts: string[],
  existingBlockMap: Record<string, string>,
): Promise<Record<string, string>> => {
  const missingBlocks = blockTexts.filter(
    (blockText) => !existingBlockMap[blockText],
  );

  if (missingBlocks.length > 0) {
    const createdBlocks = await Promise.all(
      missingBlocks.map(async (blockText) => {
        const uid = await createBlock({
          parentUid: pageUid,
          node: { text: blockText },
        });
        return { text: blockText, uid };
      }),
    );

    createdBlocks.forEach((block) => {
      existingBlockMap[block.text] = block.uid;
    });
  }

  return existingBlockMap;
};

const buildBlockMap = (pageUid: string): Record<string, string> => {
  const existingChildren = getShallowTreeByParentUid(pageUid);
  const blockMap: Record<string, string> = {};
  existingChildren.forEach((child) => {
    blockMap[child.text] = child.uid;
  });
  return blockMap;
};

const ensureLegacyConfigBlocks = async (pageUid: string): Promise<void> => {
  const pageBlockMap = buildBlockMap(pageUid);

  await ensureBlocksExist(
    pageUid,
    ["trigger", "grammar", "export", "Suggestive Mode", "Left Sidebar"],
    pageBlockMap,
  );

  const triggerMap = buildBlockMap(pageBlockMap["trigger"]);
  if (Object.keys(triggerMap).length === 0) {
    await createBlock({
      parentUid: pageBlockMap["trigger"],
      node: { text: "\\" },
    });
  }

  const grammarMap = buildBlockMap(pageBlockMap["grammar"]);
  await ensureBlocksExist(pageBlockMap["grammar"], ["relations"], grammarMap);
  const relationsChildren = getShallowTreeByParentUid(grammarMap["relations"]);
  if (relationsChildren.length === 0) {
    for (const relation of DEFAULT_RELATION_VALUES) {
      await createBlock({
        parentUid: grammarMap["relations"],
        node: relation,
      });
    }
  }

  const suggestiveMap = buildBlockMap(pageBlockMap["Suggestive Mode"]);
  await ensureBlocksExist(
    pageBlockMap["Suggestive Mode"],
    ["Page Groups"],
    suggestiveMap,
  );

  const leftSidebarMap = buildBlockMap(pageBlockMap["Left Sidebar"]);
  await ensureBlocksExist(
    pageBlockMap["Left Sidebar"],
    ["Global-Section"],
    leftSidebarMap,
  );
  const globalSectionMap = buildBlockMap(leftSidebarMap["Global-Section"]);
  await ensureBlocksExist(
    leftSidebarMap["Global-Section"],
    ["Children", "Settings"],
    globalSectionMap,
  );

  const exportMap = buildBlockMap(pageBlockMap["export"]);
  await ensureBlocksExist(
    pageBlockMap["export"],
    ["max filename length"],
    exportMap,
  );
  const maxFilenameMap = buildBlockMap(exportMap["max filename length"]);
  if (Object.keys(maxFilenameMap).length === 0) {
    await createBlock({
      parentUid: exportMap["max filename length"],
      node: { text: "64" },
    });
  }
};

const initializeSettingsBlockProps = (
  pageUid: string,
  blockMap: Record<string, string>,
): void => {
  const configs = getTopLevelBlockPropsConfig();

  for (const { key, schema } of configs) {
    const uid = blockMap[key];
    if (uid) {
      const existingProps = getBlockProps(uid);
      const defaults = schema.parse({});

      // TODO: Overwriting on safeParse failure is a temporary fix for schema shape changes
      // (e.g. specification: [] -> {enabled, query}). Replace with proper versioned migrations.
      if (
        !existingProps ||
        Object.keys(existingProps).length === 0 ||
        !schema.safeParse(existingProps).success
      ) {
        setBlockProps(uid, defaults, false);
      }

      // Reconcile placeholder relation keys with real block UIDs.
      // TODO: remove this when fully migrated to blockprops, as the keys won't need to match block UIDs anymore and the defaults can use any stable IDs.
      if (key === "Global") {
        const relations = ((existingProps as Record<string, json> | null)?.[
          "Relations"
        ] ?? (defaults as Record<string, json>)["Relations"]) as Record<
          string,
          json
        >;
        if (relations) {
          reconcileRelationKeys(pageUid, uid, relations);
        }
      }
    }
  }
};

const initSettingsPageBlocks = async (): Promise<Record<string, string>> => {
  const pageUid = await ensurePageExists(DG_BLOCK_PROP_SETTINGS_PAGE_TITLE);
  const blockMap = buildBlockMap(pageUid);

  const topLevelBlocks = getTopLevelBlockPropsConfig().map(({ key }) => key);
  await ensureBlocksExist(pageUid, topLevelBlocks, blockMap);

  await ensureLegacyConfigBlocks(pageUid);

  initializeSettingsBlockProps(pageUid, blockMap);

  return blockMap;
};

const hasNonDefaultNodes = (): boolean => {
  return getAllDiscourseNodes().some((node) => node.backedBy !== "default");
};

const initSingleDiscourseNode = async (
  node: (typeof INITIAL_NODE_VALUES)[number],
): Promise<{ label: string; pageUid: string } | null> => {
  if (!node.text) return null;

  const pageUid = await ensurePageExists(
    `${DISCOURSE_NODE_PAGE_PREFIX}${node.text}`,
  );
  const existingProps = getBlockProps(pageUid);

  // TODO: Same temporary fix as initializeSettingsBlockProps — replace with proper migrations.
  if (
    !existingProps ||
    Object.keys(existingProps).length === 0 ||
    !DiscourseNodeSchema.safeParse(existingProps).success
  ) {
    const nodeData = DiscourseNodeSchema.parse({
      text: node.text,
      type: node.type,
      format: node.format || "",
      shortcut: node.shortcut || "",
      tag: node.tag || "",
      graphOverview: node.graphOverview ?? false,
      canvasSettings: node.canvasSettings || {},
    });

    setBlockProps(pageUid, nodeData, false);
  }

  return { label: node.text, pageUid };
};

const initDiscourseNodePages = async (): Promise<Record<string, string>> => {
  if (hasNonDefaultNodes()) {
    const existingNodes = getAllDiscourseNodes();
    const nodePageUids: Record<string, string> = {};
    for (const node of existingNodes) {
      nodePageUids[node.text] = node.type;
    }
    return nodePageUids;
  }

  const results = await Promise.all(
    INITIAL_NODE_VALUES.map((node) => initSingleDiscourseNode(node)),
  );

  const nodePageUids: Record<string, string> = {};
  for (const result of results) {
    if (result) {
      nodePageUids[result.label] = result.pageUid;
    }
  }

  return nodePageUids;
};

/**
 * Replace placeholder relation keys (_INFO-rel, etc.) in the Global blockprops
 * with the actual block UIDs from the grammar > relations block tree.
 *
 * TODO: Remove this when fully migrated to blockprops. Once relations are read
 * exclusively from blockprops, the keys won't need to match block UIDs anymore
 * and the defaults can use any stable IDs.
 */
const reconcileRelationKeys = (
  pageUid: string,
  globalBlockUid: string,
  relations: Record<string, json>,
): void => {
  const placeholderKeys = Object.keys(DEFAULT_RELATIONS_BLOCK_PROPS);
  const hasPlaceholders = placeholderKeys.some((k) => k in relations);
  if (!hasPlaceholders) {
    return;
  }

  const pageChildren = getShallowTreeByParentUid(pageUid);
  const grammarBlock = pageChildren.find((c) =>
    toFlexRegex("grammar").test(c.text),
  );
  if (!grammarBlock) {
    return;
  }

  const grammarChildren = getShallowTreeByParentUid(grammarBlock.uid);
  const relationsBlock = grammarChildren.find((c) =>
    toFlexRegex("relations").test(c.text),
  );
  if (!relationsBlock) {
    return;
  }

  const relationBlocks = getShallowTreeByParentUid(relationsBlock.uid);

  const labelToUid: Record<string, string> = {};
  for (const block of relationBlocks) {
    labelToUid[block.text] = block.uid;
  }

  const placeholderToLabel: Record<string, string> = {};
  for (const [key, value] of Object.entries(DEFAULT_RELATIONS_BLOCK_PROPS)) {
    placeholderToLabel[key] = value.label;
  }

  const reconciledRelations: Record<string, json> = {};
  let changed = false;

  for (const [key, value] of Object.entries(relations)) {
    if (placeholderKeys.includes(key)) {
      const label = placeholderToLabel[key];
      const realUid = label ? labelToUid[label] : undefined;
      if (realUid) {
        reconciledRelations[realUid] = value;
        changed = true;
        continue;
      }
    }
    reconciledRelations[key] = value;
  }

  if (changed) {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    setBlockProps(globalBlockUid, { Relations: reconciledRelations }, false);
  }
};

export type InitSchemaResult = {
  blockUids: Record<string, string>;
  nodePageUids: Record<string, string>;
};

const logDualReadComparison = (): void => {
  if (!isNewSettingsStoreEnabled()) return;

  const legacyFlags = readAllLegacyFeatureFlags();
  const blockFlags = getFeatureFlags();
  const flagsMatch = JSON.stringify(blockFlags) === JSON.stringify(legacyFlags);

  const legacyGlobal = readAllLegacyGlobalSettings();
  const blockGlobal = getGlobalSettings();
  const globalMatch =
    JSON.stringify(blockGlobal) === JSON.stringify(legacyGlobal);

  const legacyPersonal = readAllLegacyPersonalSettings();
  const blockPersonal = getPersonalSettings();
  const personalMatch =
    JSON.stringify(blockPersonal) === JSON.stringify(legacyPersonal);

  const nodes = getAllDiscourseNodes();
  const nodeResults: {
    name: string;
    match: boolean;
    legacy: unknown;
    blockProps: unknown;
  }[] = [];
  for (const node of nodes) {
    const legacy = readAllLegacyDiscourseNodeSettings(node.type, node.text);
    const blockProps = getDiscourseNodeSettings(node.type);
    nodeResults.push({
      name: node.text,
      match: JSON.stringify(blockProps) === JSON.stringify(legacy),
      legacy,
      blockProps,
    });
  }

  const mismatches = [
    !flagsMatch && "Feature Flags",
    !globalMatch && "Global",
    !personalMatch && "Personal",
    ...nodeResults.filter((n) => !n.match).map((n) => n.name),
  ].filter(Boolean) as string[];

  const summary =
    mismatches.length === 0
      ? "All settings match"
      : `(${mismatches.length}) Settings don't match: ${mismatches.join(", ")}`;

  const nodeLegacy: Record<string, unknown> = {};
  const nodeBlockProps: Record<string, unknown> = {};
  for (const node of nodeResults) {
    nodeLegacy[node.name] = node.legacy;
    nodeBlockProps[node.name] = node.blockProps;
  }

  /* eslint-disable @typescript-eslint/naming-convention */
  console.log(`[DG Dual-Read] ${summary}`);
  console.log("[DG Dual-Read] Legacy:", {
    "Feature Flags": legacyFlags,
    Global: legacyGlobal,
    Personal: legacyPersonal,
    ...nodeResults.reduce(
      (acc, n) => {
        acc[n.name] = n.legacy;
        return acc;
      },
      {} as Record<string, unknown>,
    ),
  });
  console.log("[DG Dual-Read] Block props:", {
    "Feature Flags": blockFlags,
    Global: blockGlobal,
    Personal: blockPersonal,
    ...nodeResults.reduce(
      (acc, n) => {
        acc[n.name] = n.blockProps;
        return acc;
      },
      {} as Record<string, unknown>,
    ),
  });
  /* eslint-enable @typescript-eslint/naming-convention */
};

export const initSchema = async (): Promise<InitSchemaResult> => {
  const blockUids = await initSettingsPageBlocks();
  await migrateGraphLevel(blockUids);
  const nodePageUids = await initDiscourseNodePages();
  await migratePersonalSettings(blockUids);
  logDualReadComparison();
  (window as unknown as Record<string, unknown>).dgDualReadLog =
    logDualReadComparison;
  return { blockUids, nodePageUids };
};
