import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import { createPage, createBlock } from "roamjs-components/writes";
import setBlockProps from "~/utils/setBlockProps";
import getBlockProps, { type json } from "~/utils/getBlockProps";
// eslint-disable-next-line @typescript-eslint/naming-convention
import INITIAL_NODE_VALUES from "~/data/defaultDiscourseNodes";
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
  DISCOURSE_NODE_BLOCK_KEYS,
} from "../data/blockPropsSettingsConfig";

let cachedPersonalSettingsKey: string | null = null;

const getPersonalSettingsKey = (): string => {
  if (cachedPersonalSettingsKey !== null) {
    return cachedPersonalSettingsKey;
  }
  cachedPersonalSettingsKey = window.roamAlphaAPI.user.uid() || "";
  return cachedPersonalSettingsKey;
};

const getDiscourseNodePageTitle = (nodeLabel: string): string => {
  return `${DISCOURSE_NODE_PAGE_PREFIX}${nodeLabel}`;
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
  const blockMap = buildBlockMap(pageUid);

  for (const key of Object.values(DISCOURSE_NODE_BLOCK_KEYS)) {
    if (!blockMap[key]) {
      blockMap[key] = await createBlock({
        parentUid: pageUid,
        node: { text: key },
      });
    }
  }

  const templateUid = blockMap[DISCOURSE_NODE_BLOCK_KEYS.template];
  const indexUid = blockMap[DISCOURSE_NODE_BLOCK_KEYS.index];
  const specificationUid = blockMap[DISCOURSE_NODE_BLOCK_KEYS.specification];

  if (!existingProps || Object.keys(existingProps).length === 0) {
    const nodeData = DiscourseNodeSchema.parse({
      text: node.text,
      uid: pageUid,
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

const printAllSettings = (blockMap: Record<string, string>): void => {
  const featureFlagsUid = blockMap[TOP_LEVEL_BLOCK_PROP_KEYS.featureFlags];
  const globalUid = blockMap[TOP_LEVEL_BLOCK_PROP_KEYS.global];
  const personalKey = getPersonalSettingsKey();
  const personalUid = blockMap[personalKey];

  const featureFlags = featureFlagsUid ? getBlockProps(featureFlagsUid) : null;
  const globalSettings = globalUid ? getBlockProps(globalUid) : null;
  const personalSettings = personalUid ? getBlockProps(personalUid) : null;

  console.group("🔧 Discourse Graph Settings Initialized");

  if (featureFlags) {
    console.group("🚩 Feature Flags");
    console.table(featureFlags);
    console.groupEnd();
  }

  if (globalSettings) {
    console.group("🌍 Global Settings");
    console.log("Trigger:", globalSettings?.Trigger || "(empty)");
    console.log(
      "Canvas Page Format:",
      globalSettings?.["Canvas Page Format"] || "(empty)",
    );

    if (globalSettings?.["Left Sidebar"]) {
      console.group("📂 Left Sidebar");
      console.log(globalSettings["Left Sidebar"]);
      console.groupEnd();
    }

    if (globalSettings?.Export) {
      console.group("📤 Export Settings");
      console.table(globalSettings.Export);
      console.groupEnd();
    }

    if (globalSettings?.["Suggestive Mode"]) {
      console.group("💡 Suggestive Mode");
      console.log(globalSettings["Suggestive Mode"]);
      console.groupEnd();
    }

    console.groupEnd();
  }

  if (personalSettings) {
    console.group("👤 Personal Settings");
    console.log(
      "Personal Node Menu Trigger:",
      personalSettings?.["Personal Node Menu Trigger"] || "(empty)",
    );
    console.log(
      "Node Search Menu Trigger:",
      personalSettings?.["Node Search Menu Trigger"] || "(empty)",
    );
    console.log(
      "Discourse Tool Shortcut:",
      personalSettings?.["Discourse Tool Shortcut"] || "(empty)",
    );

    console.group("🎛️ Toggles");
    const toggles = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "Discourse Context Overlay":
        personalSettings?.["Discourse Context Overlay"],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "Suggestive Mode Overlay": personalSettings?.["Suggestive Mode Overlay"],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "Overlay in Canvas": personalSettings?.["Overlay in Canvas"],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "Text Selection Popup": personalSettings?.["Text Selection Popup"],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "Disable Sidebar Open": personalSettings?.["Disable Sidebar Open"],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "Page Preview": personalSettings?.["Page Preview"],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "Hide Feedback Button": personalSettings?.["Hide Feedback Button"],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "Streamline Styling": personalSettings?.["Streamline Styling"],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "Auto Canvas Relations": personalSettings?.["Auto Canvas Relations"],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "Disable Product Diagnostics":
        personalSettings?.["Disable Product Diagnostics"],
    };
    console.table(toggles);
    console.groupEnd();

    if (personalSettings?.["Left Sidebar"]) {
      console.group("📂 Personal Left Sidebar");
      console.log(personalSettings["Left Sidebar"]);
      console.groupEnd();
    }

    if (personalSettings?.Query) {
      console.group("🔍 Query Settings");
      console.table(personalSettings.Query);
      console.groupEnd();
    }

    console.groupEnd();
  }

  console.groupEnd();
};

export type InitSchemaResult = {
  blockUids: Record<string, string>;
  nodePageUids: Record<string, string>;
};

export const initSchema = async (): Promise<InitSchemaResult> => {
  const blockUids = await initSettingsPageBlocks();
  const nodePageUids = await initDiscourseNodePages();

  printAllSettings(blockUids);

  return { blockUids, nodePageUids };
};
