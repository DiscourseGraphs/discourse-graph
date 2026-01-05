import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import { createPage, createBlock } from "roamjs-components/writes";
import setBlockProps from "~/utils/setBlockProps";
import getBlockProps, { type json } from "~/utils/getBlockProps";
// eslint-disable-next-line @typescript-eslint/naming-convention
import INITIAL_NODE_VALUES from "~/data/defaultDiscourseNodes";
// eslint-disable-next-line @typescript-eslint/naming-convention
import {
  DiscourseNodeSchema,
  FeatureFlagsSchema,
  GlobalSettingsSchema,
  PersonalSettingsSchema,
} from "./zodSchema";
import type { ZodSchema } from "zod";
import {
  DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
  DISCOURSE_NODE_PAGE_PREFIX,
  TOP_LEVEL_BLOCK_PROP_KEYS,
} from "../data/blockPropsSettingsConfig";
import {
  stubSetLeftSidebarPersonalSections,
  stubGetLeftSidebarPersonalSections,
} from "./accessors";

let cachedPersonalSettingsKey: string | null = null;

export const getPersonalSettingsKey = (): string => {
  if (cachedPersonalSettingsKey !== null) {
    return cachedPersonalSettingsKey;
  }
  cachedPersonalSettingsKey = window.roamAlphaAPI.user.uid() || "";
  return cachedPersonalSettingsKey;
};

export const getDiscourseNodePageTitle = (nodeLabel: string): string => {
  return `${DISCOURSE_NODE_PAGE_PREFIX}${nodeLabel}`;
};

export const getDiscourseNodePageUid = (nodeLabel: string): string => {
  const pageTitle = getDiscourseNodePageTitle(nodeLabel);
  return getPageUidByPageTitle(pageTitle);
};

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

const ensurePersonalBlockExists = async (
  pageUid: string,
  existingBlockMap: Record<string, string>,
): Promise<{ key: string; uid: string }> => {
  const personalKey = getPersonalSettingsKey();

  if (existingBlockMap[personalKey]) {
    return { key: personalKey, uid: existingBlockMap[personalKey] };
  }

  const uid = await createBlock({
    parentUid: pageUid,
    node: { text: personalKey },
  });

  return { key: personalKey, uid };
};

const buildBlockMap = (pageUid: string): Record<string, string> => {
  const existingChildren = getShallowTreeByParentUid(pageUid);
  const blockMap: Record<string, string> = {};
  existingChildren.forEach((child) => {
    blockMap[child.text] = child.uid;
  });
  return blockMap;
};

const initBlockPropsIfEmpty = (uid: string, schema: ZodSchema): void => {
  const existingProps = getBlockProps(uid);
  if (!existingProps || Object.keys(existingProps).length === 0) {
    const defaults = schema.parse({}) as Record<string, json>;
    setBlockProps(uid, defaults, false);
  }
};

const initializeSettingsBlockProps = (
  blockMap: Record<string, string>,
): void => {
  const configs = [
    { key: TOP_LEVEL_BLOCK_PROP_KEYS.featureFlags, schema: FeatureFlagsSchema },
    { key: TOP_LEVEL_BLOCK_PROP_KEYS.global, schema: GlobalSettingsSchema },
    { key: getPersonalSettingsKey(), schema: PersonalSettingsSchema },
  ];

  for (const { key, schema } of configs) {
    const uid = blockMap[key];
    if (uid) {
      initBlockPropsIfEmpty(uid, schema);
    }
  }
};

const initSettingsPageBlocks = async (): Promise<Record<string, string>> => {
  const pageUid = await ensurePageExists(DG_BLOCK_PROP_SETTINGS_PAGE_TITLE);
  const blockMap = buildBlockMap(pageUid);

  const topLevelBlocks = Object.values(TOP_LEVEL_BLOCK_PROP_KEYS);
  await ensureBlocksExist(pageUid, topLevelBlocks, blockMap);

  const personalBlock = await ensurePersonalBlockExists(pageUid, blockMap);
  blockMap[personalBlock.key] = personalBlock.uid;

  initializeSettingsBlockProps(blockMap);

  return blockMap;
};

const ensureDiscourseNodePageExists = async (
  nodeLabel: string,
): Promise<string> => {
  const pageTitle = getDiscourseNodePageTitle(nodeLabel);
  return ensurePageExists(pageTitle);
};

const initSingleDiscourseNode = async (
  node: (typeof INITIAL_NODE_VALUES)[number],
): Promise<{ label: string; pageUid: string } | null> => {
  if (!node.text) return null;

  const pageUid = await ensureDiscourseNodePageExists(node.text);
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
      backedBy: "user",
    });

    setBlockProps(pageUid, nodeData as Record<string, json>, false);
  }

  return { label: node.text, pageUid };
};

const initDiscourseNodePages = async (): Promise<Record<string, string>> => {
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

// TODO: REMOVE the printAllSettings function after we are done testing
const printAllSettings = (
  blockMap: Record<string, string>,
  nodePageUids: Record<string, string>,
): void => {
  const featureFlagsUid = blockMap[TOP_LEVEL_BLOCK_PROP_KEYS.featureFlags];
  const globalUid = blockMap[TOP_LEVEL_BLOCK_PROP_KEYS.global];
  const personalKey = getPersonalSettingsKey();
  const personalUid = blockMap[personalKey];

  const featureFlags = featureFlagsUid ? getBlockProps(featureFlagsUid) : null;
  const globalSettings = globalUid ? getBlockProps(globalUid) : null;
  const personalSettings = personalUid ? getBlockProps(personalUid) : null;

  console.group("🔧 Discourse Graph Settings Initialized (RAW DATA)");

  // Feature Flags - complete raw data
  console.group(`🚩 Feature Flags (uid: ${featureFlagsUid})`);
  console.log("Raw block props:", JSON.stringify(featureFlags, null, 2));
  console.groupEnd();

  // Global Settings - complete raw data
  console.group(`🌍 Global Settings (uid: ${globalUid})`);
  console.log("Raw block props:", JSON.stringify(globalSettings, null, 2));
  console.groupEnd();

  // Personal Settings - complete raw data
  console.group(`👤 Personal Settings (uid: ${personalUid})`);
  console.log("Raw block props:", JSON.stringify(personalSettings, null, 2));
  console.groupEnd();

  // Discourse Nodes - complete raw data for each
  console.group("📝 Discourse Nodes");
  for (const [nodeLabel, pageUid] of Object.entries(nodePageUids)) {
    const nodeProps = getBlockProps(pageUid);
    console.group(`${nodeLabel} (uid: ${pageUid})`);
    console.log("Raw block props:", JSON.stringify(nodeProps, null, 2));
    console.groupEnd();
  }
  console.groupEnd();

  console.groupEnd();
};

export type InitSchemaResult = {
  blockUids: Record<string, string>;
  nodePageUids: Record<string, string>;
};

export const initSchema = async (): Promise<InitSchemaResult> => {
  const blockUids = await initSettingsPageBlocks();
  const nodePageUids = await initDiscourseNodePages();

  setTimeout(() => {
    printAllSettings(blockUids, nodePageUids);

    // TODO: REMOVE stub calls after testing
    stubSetLeftSidebarPersonalSections();
    setTimeout(() => {
      stubGetLeftSidebarPersonalSections();
    }, 3000);
  }, 2000);

  return { blockUids, nodePageUids };
};
