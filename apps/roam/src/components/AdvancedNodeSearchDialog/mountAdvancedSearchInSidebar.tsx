import React from "react";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import { AdvancedSearchSidebarPanel } from "./AdvancedSearchSidebarPanel";
import type { DockedSearchState } from "./utils";

const STORAGE_KEY = "dg-advanced-search-sidebar-windows";
const DG_SEARCH_ROOT_CLASS = "dg-node-search-sidebar-root";
const SIDEBAR_OPEN_WIDTH_PX = 40;
const MAX_WINDOW_WAIT_FRAMES = 30;

type RoamSidebarWindow = {
  type: string;
  "window-id": string;
  "search-query-str"?: string;
};

type PersistedDockedSearchState = DockedSearchState & {
  dgSearchId: string;
  windowId: string;
  updatedAt: number;
};

type PersistedDockedSearchRegistry = Record<string, PersistedDockedSearchState>;

const activeUnmounts = new Map<string, () => void>();
const mountingDgSearchIds = new Set<string>();

const isRightSidebarOpen = (): boolean => {
  const sidebar = document.getElementById("right-sidebar");
  return (
    !!sidebar && sidebar.getBoundingClientRect().width > SIDEBAR_OPEN_WIDTH_PX
  );
};

const getRoamSidebarWindows = async (): Promise<RoamSidebarWindow[]> => {
  try {
    const windows = await Promise.resolve(
      window.roamAlphaAPI.ui.rightSidebar.getWindows(),
    );
    return windows ?? [];
  } catch {
    return [];
  }
};

const readRegistry = (): PersistedDockedSearchRegistry => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as PersistedDockedSearchRegistry;
    if (!parsed || typeof parsed !== "object") return {};

    return parsed;
  } catch {
    return {};
  }
};

const writeRegistry = (registry: PersistedDockedSearchRegistry): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
};

const upsertRegistryEntry = ({
  dgSearchId,
  windowId,
  state,
}: {
  dgSearchId: string;
  windowId: string;
  state: DockedSearchState;
}): void => {
  const registry = readRegistry();

  for (const [id, entry] of Object.entries(registry)) {
    if (entry.windowId === windowId && id !== dgSearchId) {
      delete registry[id];
    }
  }

  registry[dgSearchId] = {
    ...state,
    dgSearchId,
    windowId,
    updatedAt: Date.now(),
  };
  writeRegistry(registry);
};

const pruneRegistry = (liveWindowIds: Set<string>): void => {
  const registry = readRegistry();
  let changed = false;

  for (const dgSearchId of Object.keys(registry)) {
    if (liveWindowIds.has(registry[dgSearchId].windowId)) continue;
    delete registry[dgSearchId];
    changed = true;
  }

  if (changed) writeRegistry(registry);
};

const listDgSearchWindows = (): PersistedDockedSearchState[] =>
  Object.values(readRegistry());

const getSearchContainer = (sidebarWindow: HTMLElement): HTMLElement | null =>
  sidebarWindow.querySelector<HTMLElement>(".rm-sidebar-search");

const findNewWindowId = (
  before: RoamSidebarWindow[],
  after: RoamSidebarWindow[],
): string | null => {
  const beforeIds = new Set(before.map((window) => window["window-id"]));
  const newWindows = after.filter(
    (window) => !beforeIds.has(window["window-id"]),
  );
  const searchQueryWindow = newWindows.find(
    (window) => window.type === "search-query",
  );
  return (
    searchQueryWindow?.["window-id"] ?? newWindows[0]?.["window-id"] ?? null
  );
};

const waitForSidebarWindowElement = async (
  windowId: string,
): Promise<HTMLElement> => {
  for (let attempt = 0; attempt < MAX_WINDOW_WAIT_FRAMES; attempt += 1) {
    const sidebarWindow = document.querySelector<HTMLElement>(
      `[data-sidebar-window-id="${windowId}"]`,
    );
    if (sidebarWindow) return sidebarWindow;

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  throw new Error("DG search sidebar window did not appear");
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

    upsertRegistryEntry({ dgSearchId, windowId, state: stateWithIds });

    const unmount = renderWithUnmount(
      <AdvancedSearchSidebarPanel
        dgSearchId={dgSearchId}
        dockedState={stateWithIds}
        onPersistState={(nextState) => {
          upsertRegistryEntry({ dgSearchId, windowId, state: nextState });
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

const syncDockedSearchWindows = async (): Promise<void> => {
  const roamWindows = await getRoamSidebarWindows();
  const liveWindowIds = new Set(
    roamWindows.map((window) => window["window-id"]),
  );
  pruneRegistry(liveWindowIds);
  restorePersistedDockedSearchSidebarWindows();
};

export const mountAdvancedSearchInSidebar = async (
  dockedState: DockedSearchState,
): Promise<void> => {
  const dgSearchId = window.roamAlphaAPI.util.generateUID();
  const roamWindowsBefore = await getRoamSidebarWindows();

  await window.roamAlphaAPI.ui.rightSidebar.addWindow({
    window: {
      type: "search-query",
      // @ts-expect-error - search-query-str replaces block-uid for search-query windows
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "search-query-str": dockedState.query,
    },
  });

  const roamWindowsAfter = await getRoamSidebarWindows();
  const windowId = findNewWindowId(roamWindowsBefore, roamWindowsAfter);
  if (!windowId) {
    throw new Error("DG search sidebar window was not created");
  }

  const sidebarWindow = await waitForSidebarWindowElement(windowId);
  mountPanelInSearchWindow({
    dgSearchId,
    dockedState,
    sidebarWindow,
    windowId,
  });
};

export const initDockedSearchSidebarPersistence = (): (() => void) => {
  void syncDockedSearchWindows();

  let wasSidebarOpen = isRightSidebarOpen();
  const rightSidebar = document.getElementById("right-sidebar");
  let sidebarResizeObserver: ResizeObserver | null = null;

  if (rightSidebar) {
    sidebarResizeObserver = new ResizeObserver(() => {
      const isOpen = isRightSidebarOpen();
      if (!wasSidebarOpen && isOpen) {
        void syncDockedSearchWindows();
      }
      wasSidebarOpen = isOpen;
    });
    sidebarResizeObserver.observe(rightSidebar);
  }

  return () => {
    sidebarResizeObserver?.disconnect();
    sidebarResizeObserver = null;

    activeUnmounts.forEach((unmount) => unmount());
    activeUnmounts.clear();
  };
};
