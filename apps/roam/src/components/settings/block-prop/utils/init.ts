import {
  TOP_LEVEL_BLOCK_PROP_KEYS,
  DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
} from "~/components/settings/block-prop/data/blockPropsSettingsConfig";
import INITIAL_NODE_VALUES from "~/components/settings/block-prop/data/defaultDiscourseNodeValues";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import { createPage, createBlock } from "roamjs-components/writes";
import setBlockProps from "~/utils/setBlockProps";
import getBlockProps, { type json } from "~/utils/getBlockProps";
import { DiscourseNodeSchema } from "~/components/settings/block-prop/utils/zodSchema";

export const DISCOURSE_NODE_PAGE_PREFIX = "discourse-graph/nodes/";

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
  blockMap: Record<string, string>,
): Promise<Record<string, string>> => {
  const blockTexts = Object.values(TOP_LEVEL_BLOCK_PROP_KEYS);

  const missingBlocks = blockTexts.filter((blockText) => !blockMap[blockText]);

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
      blockMap[block.text] = block.uid;
    });
  }

  return blockMap;
};

const ensurePersonalBlockExists = async (
  pageUid: string,
  blockMap: Record<string, string>,
): Promise<{ key: string; uid: string }> => {
  const userUid = window.roamAlphaAPI.user.uid();
  const personalKey = `${userUid}/Personal-Section`;

  if (blockMap[personalKey]) {
    return { key: personalKey, uid: blockMap[personalKey] };
  }

  const uid = await createBlock({
    parentUid: pageUid,
    node: { text: personalKey },
  });

  return { key: personalKey, uid };
};

export const getPersonalSettingsKey = (): string => {
  const userUid = window.roamAlphaAPI.user.uid();
  return `${userUid}/Personal-Section`;
};

export const getDiscourseNodePageTitle = (nodeType: string): string => {
  return `${DISCOURSE_NODE_PAGE_PREFIX}${nodeType}`;
};

export const getDiscourseNodePageUid = (
  nodeType: string,
): string | undefined => {
  const pageTitle = getDiscourseNodePageTitle(nodeType);
  const pageUid = getPageUidByPageTitle(pageTitle);
  console.log(`[DG:init] getDiscourseNodePageUid(${nodeType}) - looking for page: "${pageTitle}" - found: ${pageUid || "NOT FOUND"}`);
  return pageUid || undefined;
};

const ensureDiscourseNodePageExists = async (
  nodeType: string,
): Promise<string> => {
  const pageTitle = getDiscourseNodePageTitle(nodeType);
  return ensurePageExists(pageTitle);
};

const ensureNodeSettingBlockExists = async (
  pageUid: string,
  blockText: string,
): Promise<string> => {
  const existingChildren = getShallowTreeByParentUid(pageUid);
  const existingBlock = existingChildren.find((c) => c.text === blockText);

  if (existingBlock) {
    return existingBlock.uid;
  }

  const uid = await createBlock({
    parentUid: pageUid,
    node: { text: blockText },
  });

  return uid;
};

const initSettingsPageBlocks = async (): Promise<Record<string, string>> => {
  const pageUid = await ensurePageExists(DG_BLOCK_PROP_SETTINGS_PAGE_TITLE);
  const existingChildren = getShallowTreeByParentUid(pageUid);

  const blockMap: Record<string, string> = {};
  existingChildren.forEach((child) => {
    blockMap[child.text] = child.uid;
  });

  await ensureBlocksExist(pageUid, blockMap);

  const personalBlock = await ensurePersonalBlockExists(pageUid, blockMap);
  blockMap[personalBlock.key] = personalBlock.uid;

  return blockMap;
};

const initDiscourseNodePages = async (): Promise<Record<string, string>> => {
  console.log(`[DG:init] initDiscourseNodePages - starting with ${INITIAL_NODE_VALUES.length} default nodes`);
  const nodePageUids: Record<string, string> = {};

  for (const node of INITIAL_NODE_VALUES) {
    if (!node.text) continue;

    console.log(`[DG:init] initDiscourseNodePages - processing node: ${node.text} (type: ${node.type})`);
    // Use node.text for page title: discourse-graph/nodes/Claim
    const pageUid = await ensureDiscourseNodePageExists(node.text);
    nodePageUids[pageUid] = pageUid; // Key by pageUid since that's what getDiscourseNodes uses as type
    console.log(`[DG:init] initDiscourseNodePages - page created/found: ${pageUid}`);

    const existingProps = getBlockProps(pageUid);
    console.log(`[DG:init] initDiscourseNodePages - existing props:`, existingProps);

    const templateUid = await ensureNodeSettingBlockExists(pageUid, "Template");
    const indexUid = await ensureNodeSettingBlockExists(pageUid, "Index");
    const specificationUid = await ensureNodeSettingBlockExists(pageUid, "Specification");

    if (!existingProps || Object.keys(existingProps).length === 0) {
      const nodeData = DiscourseNodeSchema.parse({
        text: node.text || "",
        type: node.type,
        format: node.format || "",
        shortcut: node.shortcut || "",
        tag: node.tag,
        graphOverview: node.graphOverview,
        canvasSettings: node.canvasSettings || {},
        templateUid,
        indexUid,
        specificationUid,
        backedBy: "user",
      });

      console.log(`[DG:init] initDiscourseNodePages - setting block props:`, nodeData);
      setBlockProps(pageUid, nodeData as Record<string, json>, false);
    } else if (!existingProps.templateUid || !existingProps.indexUid || !existingProps.specificationUid) {
      setBlockProps(pageUid, { templateUid, indexUid, specificationUid }, true);
    }
  }

  console.log(`[DG:init] initDiscourseNodePages - completed. nodePageUids:`, nodePageUids);
  return nodePageUids;
};

export type InitSchemaResult = {
  blockUids: Record<string, string>;
  nodePageUids: Record<string, string>;
};

export type CreateDiscourseNodeResult = {
  pageUid: string;
  templateUid: string;
  indexUid: string;
  specificationUid: string;
};

export const createDiscourseNodePage = async (
  label: string,
  options?: {
    format?: string;
    shortcut?: string;
  },
): Promise<CreateDiscourseNodeResult> => {
  const pageUid = await ensureDiscourseNodePageExists(label);

  const templateUid = await ensureNodeSettingBlockExists(pageUid, "Template");
  const indexUid = await ensureNodeSettingBlockExists(pageUid, "Index");
  const specificationUid = await ensureNodeSettingBlockExists(pageUid, "Specification");

  const nodeData = DiscourseNodeSchema.parse({
    text: label,
    type: pageUid,
    format: options?.format || "",
    shortcut: options?.shortcut || "",
    templateUid,
    indexUid,
    specificationUid,
    backedBy: "user",
  });

  setBlockProps(pageUid, nodeData as Record<string, json>, false);

  return { pageUid, templateUid, indexUid, specificationUid };
};

export const initSchema = async (): Promise<InitSchemaResult> => {
  const blockUids = await initSettingsPageBlocks();
  const nodePageUids = await initDiscourseNodePages();

  return { blockUids, nodePageUids };
};
