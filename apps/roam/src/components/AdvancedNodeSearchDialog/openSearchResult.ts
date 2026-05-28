import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";

export const openSearchResultInMain = async (uid: string): Promise<void> => {
  if (getPageTitleByPageUid(uid)) {
    await window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid } });
    return;
  }
  await window.roamAlphaAPI.ui.mainWindow.openBlock({ block: { uid } });
};

export const openSearchResultFromLinkEvent = async ({
  uid,
  shiftKey,
}: {
  uid: string;
  shiftKey: boolean;
}): Promise<void> => {
  if (shiftKey) {
    await openBlockInSidebar(uid);
    return;
  }
  await openSearchResultInMain(uid);
};
