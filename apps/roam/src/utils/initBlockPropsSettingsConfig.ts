// utils/initConfigPage.ts
import getBlockUidByTextOnPage from "roamjs-components/queries/getBlockUidByTextOnPage";
import {
  TOP_LEVEL_BLOCK_PROP_KEYS,
  DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
} from "./settingsUsingBlockProps";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { createPage, createBlock } from "roamjs-components/writes";

const ensurePageExists = async (pageTitle: string): Promise<string> => {
  let pageUid = getPageUidByPageTitle(pageTitle);

  if (!pageUid) {
    pageUid = window.roamAlphaAPI.util.generateUID();
    await createPage({
      title: pageTitle,
      uid: pageUid,
    });
    console.log(`[Config] Created Page: "${pageTitle}"`);
  }

  return pageUid;
};

const ensureBlockExists = async (blockText: string, pageTitle: string) => {
  const existingUid = getBlockUidByTextOnPage({
    text: blockText,
    title: pageTitle,
  });

  if (existingUid) return existingUid;

  const pageUid = getPageUidByPageTitle(pageTitle);

  if (!pageUid) {
    console.warn(
      `[Config] Page "${pageTitle}" not found. Cannot create block "${blockText}".`,
    );
    return null;
  }

  const newUid = await createBlock({
    parentUid: pageUid,
    node: { text: blockText },
  });

  console.log(`[Config] Created missing block: "${blockText}"`);
  return newUid;
};

export const initSchema = async () => {
  console.log("[Config] Verifying Schema Integrity...");
  await ensurePageExists(DG_BLOCK_PROP_SETTINGS_PAGE_TITLE);

  await Promise.all(
    Object.values(TOP_LEVEL_BLOCK_PROP_KEYS).map((blockName) =>
      ensureBlockExists(blockName, DG_BLOCK_PROP_SETTINGS_PAGE_TITLE),
    ),
  );

  console.log("[Config] Schema Ready.");
};
