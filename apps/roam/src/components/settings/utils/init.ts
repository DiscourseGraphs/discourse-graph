import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import { createPage, createBlock } from "roamjs-components/writes";
import setBlockProps from "~/utils/setBlockProps";
import getBlockProps from "~/utils/getBlockProps";
import type { json } from "~/utils/getBlockProps";
import INITIAL_NODE_VALUES from "~/data/defaultDiscourseNodes";
import DEFAULT_RELATIONS_BLOCK_PROPS from "~/components/settings/data/defaultRelationsBlockProps";
import { getAllDiscourseNodes } from "./accessors";
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

      if (!existingProps || Object.keys(existingProps).length === 0) {
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

  if (!existingProps || Object.keys(existingProps).length === 0) {
    const nodeData = DiscourseNodeSchema.parse({
      text: node.text,
      type: node.type,
      format: node.format || "",
      shortcut: node.shortcut || "",
      tag: node.tag || "",
      graphOverview: node.graphOverview ?? false,
      canvasSettings: node.canvasSettings || {},
      backedBy: "default",
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
    setBlockProps(globalBlockUid, { Relations: reconciledRelations }, false);
  }
};

export type InitSchemaResult = {
  blockUids: Record<string, string>;
  nodePageUids: Record<string, string>;
};

export const initSchema = async (): Promise<InitSchemaResult> => {
  const blockUids = await initSettingsPageBlocks();
  const nodePageUids = await initDiscourseNodePages();
  return { blockUids, nodePageUids };
};
