import {
  TOP_LEVEL_BLOCK_PROP_KEYS,
  DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
} from "~/data/blockPropsSettingsConfig";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import { createPage, createBlock } from "roamjs-components/writes";

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
): Promise<Record<string, string>> => {
  const blockTexts = Object.values(TOP_LEVEL_BLOCK_PROP_KEYS);
  const existingChildren = getShallowTreeByParentUid(pageUid);

  const blockMap: Record<string, string> = {};
  existingChildren.forEach((child) => {
    blockMap[child.text] = child.uid;
  });

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

export const initSchema = async (): Promise<Record<string, string>> => {
  const pageUid = await ensurePageExists(DG_BLOCK_PROP_SETTINGS_PAGE_TITLE);
  return await ensureBlocksExist(pageUid);
};
