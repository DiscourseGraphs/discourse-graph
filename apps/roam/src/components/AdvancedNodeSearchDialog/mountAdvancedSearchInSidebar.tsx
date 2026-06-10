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
  type PersistedDockedSearchState,
} from "./dockedSearchSidebarStorage";
import type { DockedSearchState } from "./utils";
import { DEBOUNCE_MS } from "./utils";

export const DG_SEARCH_ROOT_CLASS = "dg-node-search-sidebar-root";
const SEARCH_QUERY_WINDOW_SELECTOR =
  '#roam-right-sidebar-content .rm-sidebar-window[data-sidebar-window-id^="sidebar-search-query"]';
const MAX_WINDOW_WAIT_FRAMES = 30;

const activeUnmounts = new Map<string, () => void>();
const windowGuardObservers = new Map<string, MutationObserver>();
const mountingDgSearchIds = new Set<string>();
let syncTimeout: number | undefined;
let syncInProgress = false;
let needsResync = false;

const createDgSearchId = (): string => window.roamAlphaAPI.util.generateUID();

const getSidebarWindowId = (sidebarWindow: HTMLElement): string | null =>
  sidebarWindow.getAttribute("data-sidebar-window-id");

const getSearchQuerySidebarWindows = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>(SEARCH_QUERY_WINDOW_SELECTOR),
];

const hasDgSearchRoot = (sidebarWindow: HTMLElement): boolean =>
  !!sidebarWindow.querySelector(`.${DG_SEARCH_ROOT_CLASS}`);

const getSearchMountContainer = (
  sidebarWindow: HTMLElement,
): HTMLElement | null => sidebarWindow.querySelector(".rm-sidebar-search");

const findSidebarWindowElement = (windowId: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-sidebar-window-id="${windowId}"]`);

const waitForNewSearchQueryWindow = async (
  previousWindowIds: Set<string>,
): Promise<HTMLElement> => {
  for (let attempt = 0; attempt < MAX_WINDOW_WAIT_FRAMES; attempt += 1) {
    const newWindow = getSearchQuerySidebarWindows().find((sidebarWindow) => {
      const windowId = getSidebarWindowId(sidebarWindow);
      return !!windowId && !previousWindowIds.has(windowId);
    });
    if (newWindow) return newWindow;

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  throw new Error("DG search sidebar window did not appear");
};

const addSearchQuerySidebarWindow = async (query: string): Promise<void> => {
  await window.roamAlphaAPI.ui.rightSidebar.addWindow({
    window: {
      type: "search-query",
      // @ts-expect-error - search-query-str replaces block-uid for search-query windows
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "search-query-str": query,
    },
  });
};

const setSidebarWindowTitle = (sidebarWindow: HTMLElement): void => {
  const titleEl = sidebarWindow.querySelector<HTMLElement>(
    ".window-headers span[style*='font-weight']",
  );
  if (titleEl) titleEl.textContent = "DG node search";
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

  const searchContainer = getSearchMountContainer(sidebarWindow);
  if (!searchContainer) return;

  const observer = new MutationObserver(() => {
    if (mountingDgSearchIds.has(dgSearchId) || hasDgSearchRoot(sidebarWindow)) {
      return;
    }

    const savedState = loadDgSearchWindowById(dgSearchId);
    if (!savedState) return;

    const windowId = getSidebarWindowId(sidebarWindow);
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

    const searchContainer = getSearchMountContainer(sidebarWindow);
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

    sidebarWindow.dataset.dgNodeSearch = "true";

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
          registerDgSearchWindow({
            dgSearchId,
            windowId,
            state: { ...nextState, dgSearchId, windowId },
          });
        }}
        windowId={windowId}
      />,
      root,
    );

    activeUnmounts.set(dgSearchId, unmount);
    setSidebarWindowTitle(sidebarWindow);
    attachWindowGuardObserver({ dgSearchId, sidebarWindow });
  } finally {
    mountingDgSearchIds.delete(dgSearchId);
  }
};

const restoreSavedDgSearchWindow = (
  savedState: PersistedDockedSearchState,
): boolean => {
  const sidebarWindow = findSidebarWindowElement(savedState.windowId);
  if (!sidebarWindow || hasDgSearchRoot(sidebarWindow)) return false;

  mountPanelInSearchWindow({
    dgSearchId: savedState.dgSearchId,
    dockedState: savedState,
    sidebarWindow,
    windowId: savedState.windowId,
  });
  return true;
};

export const restorePersistedDockedSearchSidebarWindows = (): void => {
  for (const savedState of listDgSearchWindows()) {
    restoreSavedDgSearchWindow(savedState);
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
    await pruneStaleDockedSearchSidebarStates(roamWindows);
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
  window.setTimeout(scheduleSyncSidebarWindows, 500);
};

export const mountAdvancedSearchInSidebar = async (
  dockedState: DockedSearchState,
): Promise<void> => {
  const dgSearchId = createDgSearchId();
  const roamWindowsBefore = await getRoamSidebarWindows();
  const previousWindowIds = new Set(
    roamWindowsBefore.map((window) => window["window-id"]),
  );

  await addSearchQuerySidebarWindow(dockedState.query);
  const sidebarWindow = await waitForNewSearchQueryWindow(previousWindowIds);
  const windowId = getSidebarWindowId(sidebarWindow);

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
      if (!sidebarWindow?.dataset.dgNodeSearch) return;

      const dgSearchId =
        sidebarWindow.querySelector<HTMLElement>(`.${DG_SEARCH_ROOT_CLASS}`)
          ?.dataset.dgSearchId ??
        loadDgSearchWindowByWindowId(getSidebarWindowId(sidebarWindow) ?? "")
          ?.dgSearchId;

      const windowId = getSidebarWindowId(sidebarWindow) ?? undefined;
      removeDgSearchWindow({ dgSearchId, windowId });
      if (dgSearchId) disconnectWindowGuardObserver(dgSearchId);
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
