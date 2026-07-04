import { render as renderToast } from "roamjs-components/components/Toast";
import getPageUidByBlockUid from "roamjs-components/queries/getPageUidByBlockUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { getPersonalSetting } from "~/components/settings/utils/accessors";
import { PERSONAL_KEYS } from "~/components/settings/utils/settingKeys";
import { isPageUid } from "~/utils/isPageUid";

const isTargetOpenInMainWindow = ({
  mainRawUid,
  mainPageUid,
  pageUid,
  targetBlockUid,
}: {
  mainRawUid: string | null;
  mainPageUid: string | null;
  pageUid: string;
  targetBlockUid: string;
}): boolean => {
  if (!mainRawUid) return false;
  return (
    mainPageUid === pageUid ||
    mainRawUid === targetBlockUid ||
    mainRawUid === pageUid
  );
};

type RoamSidebarWindow = {
  type: string;
  "window-id": string;
  "block-uid"?: string;
};

const showSuggestionToast = (content: string): void => {
  renderToast({
    id: "suggestive-mode-added",
    content,
    intent: "success",
    timeout: 4000,
  });
};

type RightSidebarWithOrder = typeof window.roamAlphaAPI.ui.rightSidebar & {
  setWindowOrder?: (action: {
    windows: Array<{ window: RoamSidebarWindow }>;
  }) => Promise<void>;
};

const bringSidebarWindowToTop = async (windowId: string): Promise<void> => {
  try {
    await window.roamAlphaAPI.ui.rightSidebar.open();
  } catch {
    // Sidebar may already be open.
  }

  const windows = getSidebarWindows();
  const targetIndex = windows.findIndex((w) => w["window-id"] === windowId);
  if (targetIndex <= 0) return;

  const reordered = [
    windows[targetIndex],
    ...windows.slice(0, targetIndex),
    ...windows.slice(targetIndex + 1),
  ];

  const setWindowOrder = (
    window.roamAlphaAPI.ui.rightSidebar as RightSidebarWithOrder
  ).setWindowOrder;
  if (setWindowOrder) {
    try {
      await setWindowOrder({
        windows: reordered.map((sidebarWindow) => ({ window: sidebarWindow })),
      });
      return;
    } catch (error) {
      console.warn("Failed to reorder sidebar window:", error);
    }
  }

  // Avoid clicking `.rm-title-display` — Roam shows a daily-note rename tip.
  const container = document.querySelector<HTMLElement>(
    `[data-sidebar-window-id="${windowId}"]`,
  );
  const focusTarget =
    container?.querySelector<HTMLElement>(".roam-article") ?? container;
  focusTarget?.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
  );
};

const getSidebarWindows = (): RoamSidebarWindow[] => {
  try {
    return window.roamAlphaAPI.ui.rightSidebar.getWindows() ?? [];
  } catch {
    // Sidebar API can be unavailable during Roam teardown.
    return [];
  }
};

export const notifyBlockSuggestionAdded = async (
  targetBlockUid: string,
  sourceTitle: string,
): Promise<void> => {
  const pageUid = isPageUid(targetBlockUid)
    ? targetBlockUid
    : getPageUidByBlockUid(targetBlockUid) || targetBlockUid;

  // getOpenPageOrBlockUid returns a page uid when a page is open, or a block uid
  // when the user is zoomed into a block. Resolve either to a page uid for comparison.
  const mainRawUid =
    await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
  const mainRawIsPage = mainRawUid ? isPageUid(mainRawUid) : false;
  const mainPageUid = mainRawUid
    ? mainRawIsPage
      ? mainRawUid
      : getPageUidByBlockUid(mainRawUid) || mainRawUid
    : null;
  const sourcePageUid = getPageUidByPageTitle(sourceTitle);

  const isContentPageOpenInMain = isTargetOpenInMainWindow({
    mainRawUid,
    mainPageUid,
    pageUid,
    targetBlockUid,
  });
  const isSourcePageOpenInMain =
    !!sourcePageUid &&
    (mainPageUid === sourcePageUid || mainRawUid === sourcePageUid);
  const isOpenInMain = isContentPageOpenInMain || isSourcePageOpenInMain;
  const disableSidebarOpen = getPersonalSetting<boolean>([
    PERSONAL_KEYS.disableSidebarOpen,
  ]);

  if (isOpenInMain || disableSidebarOpen) {
    showSuggestionToast(`Added to [[${sourceTitle}]]`);
    return;
  }

  const sidebarWindowsBefore = getSidebarWindows();
  const existingWindow = sidebarWindowsBefore.find(
    (w) =>
      w.type === "outline" &&
      (w["block-uid"] === targetBlockUid || w["block-uid"] === pageUid),
  );

  if (existingWindow) {
    await bringSidebarWindowToTop(existingWindow["window-id"]);
    return;
  }

  await window.roamAlphaAPI.ui.rightSidebar.addWindow({
    window: {
      type: "outline",
      // @ts-expect-error - block-uid is valid for outline sidebar windows.
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "block-uid": pageUid,
    },
  });

  await window.roamAlphaAPI.ui.rightSidebar.open();
};

export const notifyRelationSuggestionAdded = (
  sourceTitle: string,
  destinationTitle: string,
): void => {
  showSuggestionToast(
    `Added relation between [[${sourceTitle}]] and [[${destinationTitle}]]`,
  );
};
