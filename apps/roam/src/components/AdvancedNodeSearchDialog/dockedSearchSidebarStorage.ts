import type { DockedSearchState } from "./utils";

const STORAGE_KEY = "dg-advanced-search-sidebar-windows";
const SIDEBAR_OPEN_WIDTH_PX = 40;
const SEARCH_QUERY_WINDOW_ID_PREFIX = "sidebar-search-query";

export type RoamSidebarWindow = {
  type: string;
  "window-id": string;
  "search-query-str"?: string;
};

export type PersistedDockedSearchState = DockedSearchState & {
  dgSearchId: string;
  windowId: string;
  isDgSearch: true;
  updatedAt: number;
};

type PersistedDockedSearchRegistry = Record<string, PersistedDockedSearchState>;
type StoredRegistryEntry = PersistedDockedSearchState & {
  isDgSearch?: boolean;
};

export const isRightSidebarOpen = (): boolean => {
  const sidebar = document.getElementById("right-sidebar");
  return (
    !!sidebar && sidebar.getBoundingClientRect().width > SIDEBAR_OPEN_WIDTH_PX
  );
};

export const getRoamSidebarWindows = async (): Promise<RoamSidebarWindow[]> => {
  try {
    const windows = await window.roamAlphaAPI.ui.rightSidebar.getWindows();
    return windows ?? [];
  } catch {
    return [];
  }
};

const normalizeRegistryEntry = (
  key: string,
  value: StoredRegistryEntry,
): PersistedDockedSearchState | null => {
  if (!value.query) return null;

  return {
    ...value,
    dgSearchId: value.dgSearchId ?? key,
    windowId: value.windowId ?? key,
    isDgSearch: true,
    updatedAt: value.updatedAt ?? Date.now(),
  };
};

const readRegistry = (): PersistedDockedSearchRegistry => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, StoredRegistryEntry>;
    if (!parsed || typeof parsed !== "object") return {};

    const registry: PersistedDockedSearchRegistry = {};
    for (const [key, value] of Object.entries(parsed)) {
      const entry = normalizeRegistryEntry(key, value);
      if (entry) registry[entry.dgSearchId] = entry;
    }
    return registry;
  } catch {
    return {};
  }
};

const writeRegistry = (registry: PersistedDockedSearchRegistry): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
};

const removeOtherEntriesWithWindowId = (
  registry: PersistedDockedSearchRegistry,
  windowId: string,
  keepDgSearchId: string,
): void => {
  for (const [id, entry] of Object.entries(registry)) {
    if (entry.windowId === windowId && id !== keepDgSearchId) {
      delete registry[id];
    }
  }
};

const upsertRegistryEntry = (
  registry: PersistedDockedSearchRegistry,
  {
    dgSearchId,
    windowId,
    state,
  }: {
    dgSearchId: string;
    windowId: string;
    state: DockedSearchState;
  },
): void => {
  removeOtherEntriesWithWindowId(registry, windowId, dgSearchId);
  registry[dgSearchId] = {
    ...state,
    dgSearchId,
    windowId,
    isDgSearch: true,
    updatedAt: Date.now(),
  };
};

const getSearchQueryWindows = (
  roamWindows: RoamSidebarWindow[],
): RoamSidebarWindow[] =>
  roamWindows.filter((window) => window.type === "search-query");

const getDomSearchQueryWindowIds = (): Set<string> =>
  new Set(
    [
      ...document.querySelectorAll<HTMLElement>(
        `[data-sidebar-window-id^="${SEARCH_QUERY_WINDOW_ID_PREFIX}"]`,
      ),
    ]
      .map((element) => element.dataset.sidebarWindowId)
      .filter((windowId): windowId is string => Boolean(windowId)),
  );

export const registerDgSearchWindow = ({
  dgSearchId,
  windowId,
  state,
}: {
  dgSearchId: string;
  windowId: string;
  state: DockedSearchState;
}): void => {
  const registry = readRegistry();
  upsertRegistryEntry(registry, { dgSearchId, windowId, state });
  writeRegistry(registry);
};

export const loadDgSearchWindowById = (
  dgSearchId: string,
): PersistedDockedSearchState | null => readRegistry()[dgSearchId] ?? null;

export const loadDgSearchWindowByWindowId = (
  windowId: string,
): PersistedDockedSearchState | null =>
  Object.values(readRegistry()).find((entry) => entry.windowId === windowId) ??
  null;

export const removeDgSearchWindow = ({
  dgSearchId,
  windowId,
}: {
  dgSearchId?: string;
  windowId?: string;
}): void => {
  const registry = readRegistry();
  const idToRemove =
    (dgSearchId && registry[dgSearchId] ? dgSearchId : undefined) ??
    (windowId
      ? Object.entries(registry).find(
          ([, entry]) => entry.windowId === windowId,
        )?.[0]
      : undefined);

  if (!idToRemove) return;

  delete registry[idToRemove];
  writeRegistry(registry);
};

export const listDgSearchWindows = (): PersistedDockedSearchState[] =>
  Object.values(readRegistry());

export const syncDgSearchWindowIdsFromRoam = (
  roamWindows: RoamSidebarWindow[],
): void => {
  const registry = readRegistry();
  const unmatchedRoamWindows = [...getSearchQueryWindows(roamWindows)];
  let changed = false;

  for (const entry of Object.values(registry)) {
    const exactMatchIndex = unmatchedRoamWindows.findIndex(
      (window) => window["window-id"] === entry.windowId,
    );
    if (exactMatchIndex >= 0) {
      unmatchedRoamWindows.splice(exactMatchIndex, 1);
      continue;
    }

    const queryMatches = unmatchedRoamWindows.filter(
      (window) => window["search-query-str"] === entry.query,
    );
    if (queryMatches.length !== 1) continue;

    const [matchedWindow] = queryMatches;
    const roamWindowId = matchedWindow["window-id"];
    removeOtherEntriesWithWindowId(registry, roamWindowId, entry.dgSearchId);
    registry[entry.dgSearchId] = {
      ...entry,
      windowId: roamWindowId,
      updatedAt: Date.now(),
    };
    unmatchedRoamWindows.splice(unmatchedRoamWindows.indexOf(matchedWindow), 1);
    changed = true;
  }

  if (changed) writeRegistry(registry);
};

export const pruneStaleDockedSearchSidebarStates = (
  roamWindows: RoamSidebarWindow[],
): void => {
  if (!isRightSidebarOpen()) return;

  const liveRoamWindowIds = new Set(
    roamWindows.map((window) => window["window-id"]),
  );
  const domWindowIds = getDomSearchQueryWindowIds();
  const registry = readRegistry();
  let changed = false;

  for (const dgSearchId of Object.keys(registry)) {
    const { windowId } = registry[dgSearchId];
    if (liveRoamWindowIds.has(windowId) || domWindowIds.has(windowId)) {
      continue;
    }

    delete registry[dgSearchId];
    changed = true;
  }

  if (changed) writeRegistry(registry);
};
