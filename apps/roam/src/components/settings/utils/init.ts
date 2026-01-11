import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import { createPage, createBlock } from "roamjs-components/writes";
import setBlockProps from "~/utils/setBlockProps";
import getBlockProps  from "~/utils/getBlockProps";
import INITIAL_NODE_VALUES from "~/data/defaultDiscourseNodes";
import {
  stubSetLeftSidebarPersonalSections,
  getAllDiscourseNodes,
} from "./accessors";
import {
  DiscourseNodeSchema,
  getTopLevelBlockPropsConfig,
} from "~/components/settings/utils/zodSchema";
import { DG_BLOCK_PROP_SETTINGS_PAGE_TITLE, DISCOURSE_NODE_PAGE_PREFIX } from "./zodSchema";


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
  blockMap: Record<string, string>,
): void => {
  const configs = getTopLevelBlockPropsConfig();

  for (const { key, schema } of configs) {
    const uid = blockMap[key];
    if (uid) {
      const existingProps = getBlockProps(uid);
      if (!existingProps || Object.keys(existingProps).length === 0) {
        const defaults = schema.parse({});
        setBlockProps(uid, defaults, false);
      }
    }
  }
};

const initSettingsPageBlocks = async (): Promise<Record<string, string>> => {
  const pageUid = await ensurePageExists(DG_BLOCK_PROP_SETTINGS_PAGE_TITLE);
  const blockMap = buildBlockMap(pageUid);

  const topLevelBlocks = getTopLevelBlockPropsConfig().map(({ key }) => key);
  await ensureBlocksExist(pageUid, topLevelBlocks, blockMap);

  initializeSettingsBlockProps(blockMap);

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

export type InitSchemaResult = {
  blockUids: Record<string, string>;
  nodePageUids: Record<string, string>;
};

export const initSchema = async (): Promise<InitSchemaResult> => {
  const blockUids = await initSettingsPageBlocks();
  const nodePageUids = await initDiscourseNodePages();
  return { blockUids, nodePageUids };
};
