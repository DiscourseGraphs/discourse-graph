import { render as renderToast } from "roamjs-components/components/Toast";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getPageUidByBlockUid from "roamjs-components/queries/getPageUidByBlockUid";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import { getPersonalSetting } from "~/components/settings/utils/accessors";
import { PERSONAL_KEYS } from "~/components/settings/utils/settingKeys";
import { isPageUid } from "~/utils/isPageUid";

type RoamSidebarWindow = {
  type: string;
  "window-id": string;
  "block-uid"?: string;
};

export type NotifySuggestiveModeAdoptedParams =
  | { adoptionType: "block"; targetBlockUid: string }
  | { adoptionType: "relation"; sourceTitle: string; destinationTitle: string };

const resolveTargetPageUid = (blockUid: string): string => {
  if (isPageUid(blockUid)) return blockUid;
  return getPageUidByBlockUid(blockUid) || blockUid;
};

const isTargetOpenInMainWindow = (targetBlockUid: string): boolean => {
  const mainWindowUid = getCurrentPageUid();
  if (!mainWindowUid) return false;
  if (mainWindowUid === targetBlockUid) return true;
  return mainWindowUid === resolveTargetPageUid(targetBlockUid);
};

const getSidebarWindows = (): RoamSidebarWindow[] => {
  try {
    const windows = window.roamAlphaAPI.ui.rightSidebar.getWindows();
    return windows ?? [];
  } catch {
    return [];
  }
};

const findOutlineSidebarWindowId = ({
  blockUid,
  pageUid,
  windows,
}: {
  blockUid: string;
  pageUid: string;
  windows: RoamSidebarWindow[];
}): string | undefined => {
  return windows.find(
    (w) =>
      w.type === "outline" &&
      (w["block-uid"] === blockUid || w["block-uid"] === pageUid),
  )?.["window-id"];
};

const bringSidebarWindowToTop = (windowId: string): void => {
  const sidebarWindow = document.querySelector<HTMLElement>(
    `[data-sidebar-window-id="${windowId}"]`,
  );
  const titleDisplay =
    sidebarWindow?.querySelector<HTMLElement>(".rm-title-display") ??
    document.querySelector<HTMLElement>(
      ".rm-sidebar-outline .rm-title-display",
    );

  titleDisplay?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
};

const focusTopSidebarOutline = (): void => {
  setTimeout(() => {
    document
      .querySelector<HTMLElement>(".rm-sidebar-outline .rm-title-display")
      ?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  }, 100);
};

const showBlockAdoptedToast = (pageUid: string): void => {
  const pageTitle = getPageTitleByPageUid(pageUid);
  renderToast({
    id: "suggestive-mode-adopted",
    content: pageTitle ? `Added to [[${pageTitle}]]` : "Added to outline",
    intent: "success",
    timeout: 4000,
  });
};

const notifyBlockAdopted = async (targetBlockUid: string): Promise<void> => {
  const pageUid = resolveTargetPageUid(targetBlockUid);

  if (isTargetOpenInMainWindow(targetBlockUid)) {
    showBlockAdoptedToast(pageUid);
    return;
  }

  if (getPersonalSetting<boolean>([PERSONAL_KEYS.disableSidebarOpen])) {
    showBlockAdoptedToast(pageUid);
    return;
  }

  const existingWindowId = findOutlineSidebarWindowId({
    blockUid: targetBlockUid,
    pageUid,
    windows: getSidebarWindows(),
  });

  if (existingWindowId) {
    bringSidebarWindowToTop(existingWindowId);
    return;
  }

  await openBlockInSidebar(targetBlockUid);
  focusTopSidebarOutline();
};

export const notifySuggestiveModeAdopted = async (
  params: NotifySuggestiveModeAdoptedParams,
): Promise<void> => {
  if (params.adoptionType === "relation") {
    renderToast({
      id: "suggestive-mode-adopted",
      content: `Added relation between [[${params.sourceTitle}]] and [[${params.destinationTitle}]]`,
      intent: "success",
      timeout: 4000,
    });
    return;
  }

  await notifyBlockAdopted(params.targetBlockUid);
};
