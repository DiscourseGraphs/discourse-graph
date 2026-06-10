import React from "react";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import { AdvancedSearchSidebarPanel } from "./AdvancedSearchSidebarPanel";
import {
  getRoamSidebarWindows,
  isRightSidebarOpen,
  listDgSearchWindows,
  loadDgSearchWindowById,
  loadDgSearchWindowByWindowId,
  pruneStaleDockedSearchSidebarStates,
  registerDgSearchWindow,
  removeDgSearchWindow,
  syncDgSearchWindowIdsFromRoam,
} from "./dockedSearchSidebarStorage";
import type { DockedSearchState } from "./utils";
import { DEBOUNCE_MS } from "./utils";

const DG_SEARCH_ROOT_CLASS = "dg-node-search-sidebar-root";
const SEARCH_QUERY_WINDOW_SELECTOR =
  '#roam-right-sidebar-content .rm-sidebar-window[data-sidebar-window-id^="sidebar-search-query"]';
const MAX_WINDOW_WAIT_FRAMES = 30;
const INITIAL_SYNC_DELAY_MS = 500;

const activeUnmounts = new Map<string, () => void>();
const windowGuardObservers = new Map<string, MutationObserver>();
const mountingDgSearchIds = new Set<string>();
let syncTimeout: number | undefined;
let syncInProgress = false;
let needsResync = false;

const getSearchContainer = (sidebarWindow: HTMLElement): HTMLElement | null =>
  sidebarWindow.querySelector<HTMLElement>(".rm-sidebar-search");

const waitForNewSearchQueryWindow = async (
  previousWindowIds: Set<string>,
): Promise<HTMLElement> => {
  for (let attempt = 0; attempt < MAX_WINDOW_WAIT_FRAMES; attempt += 1) {
    const windows = document.querySelectorAll<HTMLElement>(
      SEARCH_QUERY_WINDOW_SELECTOR,
    );
    for (const sidebarWindow of windows) {
      const windowId = sidebarWindow.dataset.sidebarWindowId;
      if (windowId && !previousWindowIds.has(windowId)) {
        return sidebarWindow;
      }
    }

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  throw new Error("DG search sidebar window did not appear");
};

const disconnectWindowGuardObserver = (dgSearchId: string): void => {
  windowGuardObservers.get(dgSearchId)?.disconnect();
  windowGuardObservers.delete(dgSearchId);
};

const attachWindowGuardObserver = ({
  dgSearchId,
  sidebarWindow,
}: {
  dgSearchId: string;
  sidebarWindow: HTMLElement;
}): void => {
  disconnectWindowGuardObserver(dgSearchId);

  const searchContainer = getSearchContainer(sidebarWindow);
  if (!searchContainer) return;

  const observer = new MutationObserver(() => {
    if (
      mountingDgSearchIds.has(dgSearchId) ||
      sidebarWindow.querySelector(`.${DG_SEARCH_ROOT_CLASS}`)
    ) {
      return;
    }

    const savedState = loadDgSearchWindowById(dgSearchId);
    if (!savedState) return;

    const windowId = sidebarWindow.dataset.sidebarWindowId;
    if (!windowId) return;

    mountPanelInSearchWindow({
      dgSearchId,
      dockedState: savedState,
      sidebarWindow,
      windowId,
    });
  });

  observer.observe(searchContainer, { childList: true, subtree: true });
  windowGuardObservers.set(dgSearchId, observer);
};

const mountPanelInSearchWindow = ({
  dgSearchId,
  dockedState,
  sidebarWindow,
  windowId,
}: {
  dgSearchId: string;
  dockedState: DockedSearchState;
  sidebarWindow: HTMLElement;
  windowId: string;
}): void => {
  if (mountingDgSearchIds.has(dgSearchId)) return;

  mountingDgSearchIds.add(dgSearchId);
  try {
    disconnectWindowGuardObserver(dgSearchId);
    activeUnmounts.get(dgSearchId)?.();
    activeUnmounts.delete(dgSearchId);

    const searchContainer = getSearchContainer(sidebarWindow);
    if (!searchContainer) {
      throw new Error("DG search sidebar window is missing .rm-sidebar-search");
    }

    searchContainer.innerHTML = "";

    const root = document.createElement("div");
    root.className = `${DG_SEARCH_ROOT_CLASS} box-border w-full min-w-0`;
    root.dataset.dgSearchId = dgSearchId;
    root.dataset.dgWindowId = windowId;
    root.onmousedown = (event) => event.stopPropagation();
    searchContainer.appendChild(root);

    const stateWithIds: DockedSearchState = {
      ...dockedState,
      dgSearchId,
      windowId,
    };

    registerDgSearchWindow({ dgSearchId, windowId, state: stateWithIds });

    const unmount = renderWithUnmount(
      <AdvancedSearchSidebarPanel
        dgSearchId={dgSearchId}
        dockedState={stateWithIds}
        onPersistState={(nextState) => {
          registerDgSearchWindow({ dgSearchId, windowId, state: nextState });
        }}
        windowId={windowId}
      />,
      root,
    );

    activeUnmounts.set(dgSearchId, unmount);

    const titleEl = sidebarWindow.querySelector<HTMLElement>(
      ".window-headers span[style*='font-weight']",
    );
    if (titleEl) titleEl.textContent = "DG node search";

    attachWindowGuardObserver({ dgSearchId, sidebarWindow });
  } finally {
    mountingDgSearchIds.delete(dgSearchId);
  }
};

const restorePersistedDockedSearchSidebarWindows = (): void => {
  for (const savedState of listDgSearchWindows()) {
    const sidebarWindow = document.querySelector<HTMLElement>(
      `[data-sidebar-window-id="${savedState.windowId}"]`,
    );
    if (
      !sidebarWindow ||
      sidebarWindow.querySelector(`.${DG_SEARCH_ROOT_CLASS}`)
    ) {
      continue;
    }

    mountPanelInSearchWindow({
      dgSearchId: savedState.dgSearchId,
      dockedState: savedState,
      sidebarWindow,
      windowId: savedState.windowId,
    });
  }
};

const syncSidebarWindows = async (): Promise<void> => {
  if (syncInProgress) {
    needsResync = true;
    return;
  }
  syncInProgress = true;

  try {
    const roamWindows = await getRoamSidebarWindows();
    syncDgSearchWindowIdsFromRoam(roamWindows);
    restorePersistedDockedSearchSidebarWindows();
    pruneStaleDockedSearchSidebarStates(roamWindows);
  } finally {
    syncInProgress = false;
    if (needsResync) {
      needsResync = false;
      void syncSidebarWindows();
    }
  }
};

const scheduleSyncSidebarWindows = (): void => {
  window.clearTimeout(syncTimeout);
  syncTimeout = window.setTimeout(() => {
    void syncSidebarWindows();
  }, DEBOUNCE_MS);
};

const scheduleInitialSync = (): void => {
  scheduleSyncSidebarWindows();
  window.setTimeout(scheduleSyncSidebarWindows, INITIAL_SYNC_DELAY_MS);
};

export const mountAdvancedSearchInSidebar = async (
  dockedState: DockedSearchState,
): Promise<void> => {
  const dgSearchId = window.roamAlphaAPI.util.generateUID();
  const roamWindowsBefore = await getRoamSidebarWindows();
  const previousWindowIds = new Set(
    roamWindowsBefore.map((window) => window["window-id"]),
  );

  await window.roamAlphaAPI.ui.rightSidebar.addWindow({
    window: {
      type: "search-query",
      // @ts-expect-error - search-query-str replaces block-uid for search-query windows
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "search-query-str": dockedState.query,
    },
  });

  const sidebarWindow = await waitForNewSearchQueryWindow(previousWindowIds);
  const windowId = sidebarWindow.dataset.sidebarWindowId;

  if (!windowId) {
    throw new Error(
      "DG search sidebar window is missing data-sidebar-window-id",
    );
  }

  mountPanelInSearchWindow({
    dgSearchId,
    dockedState,
    sidebarWindow,
    windowId,
  });

  scheduleSyncSidebarWindows();
};

let persistenceObserver: MutationObserver | null = null;
let sidebarResizeObserver: ResizeObserver | null = null;
let sidebarCloseClickHandler: ((event: MouseEvent) => void) | null = null;

export const initDockedSearchSidebarPersistence = (): (() => void) => {
  scheduleInitialSync();

  persistenceObserver?.disconnect();
  persistenceObserver = new MutationObserver(() => {
    scheduleSyncSidebarWindows();
  });

  const sidebarContent = document.getElementById("roam-right-sidebar-content");
  if (sidebarContent) {
    persistenceObserver.observe(sidebarContent, {
      childList: true,
      subtree: true,
    });

    sidebarCloseClickHandler = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const closeButton = target.closest(".window-headers .bp3-icon-cross");
      if (!closeButton) return;

      const sidebarWindow =
        closeButton.closest<HTMLElement>(".rm-sidebar-window");
      if (!sidebarWindow) return;

      const windowId = sidebarWindow.dataset.sidebarWindowId;
      const dgSearchId =
        sidebarWindow.querySelector<HTMLElement>(`.${DG_SEARCH_ROOT_CLASS}`)
          ?.dataset.dgSearchId ??
        loadDgSearchWindowByWindowId(windowId ?? "")?.dgSearchId;
      if (!dgSearchId) return;

      removeDgSearchWindow({ dgSearchId, windowId });
      disconnectWindowGuardObserver(dgSearchId);
    };

    sidebarContent.addEventListener("click", sidebarCloseClickHandler, true);
  }

  let wasSidebarOpen = isRightSidebarOpen();
  const rightSidebar = document.getElementById("right-sidebar");
  if (rightSidebar) {
    sidebarResizeObserver = new ResizeObserver(() => {
      const isOpen = isRightSidebarOpen();
      if (!wasSidebarOpen && isOpen) {
        scheduleInitialSync();
      }
      wasSidebarOpen = isOpen;
    });
    sidebarResizeObserver.observe(rightSidebar);
  }

  return () => {
    window.clearTimeout(syncTimeout);
    syncTimeout = undefined;

    persistenceObserver?.disconnect();
    persistenceObserver = null;

    sidebarResizeObserver?.disconnect();
    sidebarResizeObserver = null;

    if (sidebarContent && sidebarCloseClickHandler) {
      sidebarContent.removeEventListener(
        "click",
        sidebarCloseClickHandler,
        true,
      );
      sidebarCloseClickHandler = null;
    }

    windowGuardObservers.forEach((observer) => observer.disconnect());
    windowGuardObservers.clear();

    activeUnmounts.forEach((unmount) => unmount());
    activeUnmounts.clear();
  };
};
