import { render as renderToast } from "roamjs-components/components/Toast";
import getPageUidByBlockUid from "roamjs-components/queries/getPageUidByBlockUid";
import { getPersonalSetting } from "~/components/settings/utils/accessors";
import { PERSONAL_KEYS } from "~/components/settings/utils/settingKeys";
import { isPageUid } from "~/utils/isPageUid";

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

// When opening a new window, omit windowId and pass a delay to let Roam finish rendering.
const focusSidebarOutline = (windowId?: string, delayMs = 0): void => {
  const focus = () => {
    const container = windowId
      ? document.querySelector<HTMLElement>(
          `[data-sidebar-window-id="${windowId}"]`,
        )
      : document.querySelector<HTMLElement>(".rm-sidebar-outline");
    container
      ?.querySelector<HTMLElement>(".rm-title-display")
      ?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  };
  delayMs > 0 ? setTimeout(focus, delayMs) : focus();
};

const getSidebarWindows = (): RoamSidebarWindow[] => {
  try {
    return window.roamAlphaAPI.ui.rightSidebar.getWindows() ?? [];
  } catch {
    // Sidebar API can be unavailable during Roam teardown.
    return [];
  }
};

const findNewWindowId = ({
  before,
  after,
}: {
  before: RoamSidebarWindow[];
  after: RoamSidebarWindow[];
}): string | undefined => {
  const beforeIds = new Set(before.map((w) => w["window-id"]));
  return after.find((w) => !beforeIds.has(w["window-id"]))?.["window-id"];
};

export const notifyBlockSuggestionAdded = async (
  targetBlockUid: string,
  sourceTitle: string,
  destinationTitle: string,
): Promise<void> => {
  const pageUid = isPageUid(targetBlockUid)
    ? targetBlockUid
    : getPageUidByBlockUid(targetBlockUid) || targetBlockUid;

  // getOpenPageOrBlockUid returns a page uid when a page is open, or a block uid
  // when the user is zoomed into a block. Resolve either to a page uid for comparison.
  const mainRawUid =
    await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
  const mainPageUid = mainRawUid
    ? isPageUid(mainRawUid)
      ? mainRawUid
      : getPageUidByBlockUid(mainRawUid) || mainRawUid
    : null;
  const isOpenInMain = mainPageUid === pageUid;

  if (
    isOpenInMain ||
    getPersonalSetting<boolean>([PERSONAL_KEYS.disableSidebarOpen])
  ) {
    showSuggestionToast(
      `Added relation between [[${sourceTitle}]] and [[${destinationTitle}]]`,
    );
    return;
  }

  const sidebarWindowsBefore = getSidebarWindows();
  const existingWindow = sidebarWindowsBefore.find(
    (w) =>
      w.type === "outline" &&
      (w["block-uid"] === targetBlockUid || w["block-uid"] === pageUid),
  );

  if (existingWindow) {
    focusSidebarOutline(existingWindow["window-id"]);
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

  const newWindowId = findNewWindowId({
    before: sidebarWindowsBefore,
    after: getSidebarWindows(),
  });
  focusSidebarOutline(newWindowId, newWindowId ? 0 : 100);
};

export const notifyRelationSuggestionAdded = (
  sourceTitle: string,
  destinationTitle: string,
): void => {
  showSuggestionToast(
    `Added relation between [[${sourceTitle}]] and [[${destinationTitle}]]`,
  );
};
