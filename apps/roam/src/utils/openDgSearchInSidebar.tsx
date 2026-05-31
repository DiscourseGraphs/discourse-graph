import React from "react";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import { AdvancedSearchSidebarPanel } from "../components/AdvancedNodeSearchDialog/AdvancedSearchSidebarPanel";
import {
  type SearchResult,
  type SortConfig,
} from "~/components/AdvancedNodeSearchDialog/utils";

const SIDEBAR_ROOT_ID = "dg-node-search-sidebar-root";
const OUTLINE_WRAPPER_SELECTOR =
  "#roam-right-sidebar-content .rm-sidebar-outline-wrapper";
const SIDEBAR_OPEN_WIDTH_PX = 40;
const MAX_WRAPPER_WAIT_FRAMES = 30;

export type DockedSearchState = {
  query: string;
  results: SearchResult[];
  selectedNodeTypeIds: string[];
  sort: SortConfig;
};

let unmountSidebarSearch: (() => void) | null = null;

const isRightSidebarOpen = (): boolean => {
  const sidebar = document.getElementById("right-sidebar");
  return (
    !!sidebar && sidebar.getBoundingClientRect().width > SIDEBAR_OPEN_WIDTH_PX
  );
};

const getOutlineWrapperCount = (): number =>
  document.querySelectorAll(OUTLINE_WRAPPER_SELECTOR).length;

const getLatestOutlineWrapper = (): HTMLElement | null => {
  const wrappers = document.querySelectorAll<HTMLElement>(
    OUTLINE_WRAPPER_SELECTOR,
  );
  return wrappers[wrappers.length - 1] ?? null;
};

const waitForOutlineWrapper = async (
  minCount: number,
): Promise<HTMLElement> => {
  for (let attempt = 0; attempt < MAX_WRAPPER_WAIT_FRAMES; attempt += 1) {
    const wrappers = document.querySelectorAll<HTMLElement>(
      OUTLINE_WRAPPER_SELECTOR,
    );
    if (wrappers.length >= minCount && wrappers.length > 0) {
      return wrappers[wrappers.length - 1];
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  throw new Error("Sidebar window did not appear");
};

const openRightSidebar = async ({
  anchorPageUid,
  wrapperCountBefore,
}: {
  anchorPageUid: string;
  wrapperCountBefore: number;
}): Promise<HTMLElement | null> => {
  const rightSidebar = window.roamAlphaAPI.ui.rightSidebar as {
    open?: () => Promise<void>;
  };
  if (rightSidebar.open) {
    await rightSidebar.open();
    return null;
  }

  await addOutlineSidebarWindow(anchorPageUid);
  return waitForOutlineWrapper(Math.max(wrapperCountBefore + 1, 1));
};

const addOutlineSidebarWindow = async (blockUid: string): Promise<void> => {
  await window.roamAlphaAPI.ui.rightSidebar.addWindow({
    window: {
      type: "outline",
      // @ts-expect-error - block-uid is valid for outline sidebar windows
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "block-uid": blockUid,
    },
  });
};

const setSidebarWindowTitle = (outlineWrapper: HTMLElement): void => {
  const pane = outlineWrapper.closest<HTMLElement>(
    "#roam-right-sidebar-content .sidebar-content > *",
  );
  const titleEl = pane?.querySelector<HTMLElement>(
    ".window-headers span[style*='font-weight']",
  );
  if (titleEl) titleEl.textContent = "DG node search";
};

const mountPanelInOutlineWrapper = ({
  dockedState,
  outlineWrapper,
}: {
  dockedState: DockedSearchState;
  outlineWrapper: HTMLElement;
}): void => {
  unmountSidebarSearch?.();
  unmountSidebarSearch = null;

  outlineWrapper.innerHTML = "";

  const root = document.createElement("div");
  root.id = SIDEBAR_ROOT_ID;
  root.className =
    "rm-sidebar-search dg-node-search-sidebar-root box-border w-full min-w-0";
  root.onmousedown = (event) => event.stopPropagation();
  outlineWrapper.appendChild(root);

  unmountSidebarSearch = renderWithUnmount(
    <AdvancedSearchSidebarPanel dockedState={dockedState} />,
    root,
  );
};

export const openDgSearchInSidebar = async (
  dockedState: DockedSearchState,
): Promise<void> => {
  const anchorPageUid =
    (await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid()) ||
    window.roamAlphaAPI.util.dateToPageUid(new Date());
  const wrapperCountBefore = getOutlineWrapperCount();

  if (!isRightSidebarOpen()) {
    const openedWrapper = await openRightSidebar({
      anchorPageUid,
      wrapperCountBefore,
    });
    if (openedWrapper) {
      setSidebarWindowTitle(openedWrapper);
      mountPanelInOutlineWrapper({
        dockedState,
        outlineWrapper: openedWrapper,
      });
      return;
    }
  }

  const existingWrapper = getLatestOutlineWrapper();
  if (existingWrapper) {
    setSidebarWindowTitle(existingWrapper);
    mountPanelInOutlineWrapper({
      dockedState,
      outlineWrapper: existingWrapper,
    });
    return;
  }

  await addOutlineSidebarWindow(anchorPageUid);
  const outlineWrapper = await waitForOutlineWrapper(wrapperCountBefore + 1);
  setSidebarWindowTitle(outlineWrapper);
  mountPanelInOutlineWrapper({ dockedState, outlineWrapper });
};
