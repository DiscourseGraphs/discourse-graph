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

const ensureBlocksExist = async (pageUid: string): Promise<void> => {
  const blockTexts = Object.values(TOP_LEVEL_BLOCK_PROP_KEYS);
  const existingChildren = getShallowTreeByParentUid(pageUid);
  const existingTexts = new Set(existingChildren.map((child) => child.text));

  const missingBlocks = blockTexts.filter(
    (blockText) => !existingTexts.has(blockText),
  );

  if (missingBlocks.length > 0) {
    await Promise.all(
      missingBlocks.map((blockText) =>
        createBlock({
          parentUid: pageUid,
          node: { text: blockText },
        }),
      ),
    );
  }
};

export const initSchema = async () => {
  const pageUid = await ensurePageExists(DG_BLOCK_PROP_SETTINGS_PAGE_TITLE);
  await ensureBlocksExist(pageUid);
};
