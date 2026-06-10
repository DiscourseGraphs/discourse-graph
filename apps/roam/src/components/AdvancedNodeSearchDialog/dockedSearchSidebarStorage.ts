import type { DockedSearchState } from "./utils";

const STORAGE_KEY = "dg-advanced-search-sidebar-windows";
const SIDEBAR_OPEN_WIDTH_PX = 40;

export type RoamSidebarWindow = {
  type: string;
  "window-id": string;
  order?: number;
  "pinned?"?: boolean;
  "collapsed?"?: boolean;
  "search-query-str"?: string;
};

export type PersistedDockedSearchState = DockedSearchState & {
  dgSearchId: string;
  windowId: string;
  isDgSearch: true;
  updatedAt: number;
};

type PersistedDockedSearchRegistry = Record<string, PersistedDockedSearchState>;

export const isRightSidebarOpen = (): boolean => {
  const sidebar = document.getElementById("right-sidebar");
  return (
    !!sidebar && sidebar.getBoundingClientRect().width > SIDEBAR_OPEN_WIDTH_PX
  );
};

export const getRoamSidebarWindows = async (): Promise<RoamSidebarWindow[]> => {
  const rightSidebar = window.roamAlphaAPI.ui.rightSidebar as {
    getWindows?: () => Promise<RoamSidebarWindow[]>;
  };
  if (!rightSidebar.getWindows) return [];

  try {
    return (await rightSidebar.getWindows()) ?? [];
  } catch {
    return [];
  }
};

const normalizeRegistryEntry = (
  key: string,
  value: PersistedDockedSearchState & { isDgSearch?: boolean },
): PersistedDockedSearchState | null => {
  if (!value.query) return null;

  const dgSearchId = value.dgSearchId ?? key;
  const windowId = value.windowId ?? key;

  return {
    ...value,
    dgSearchId,
    windowId,
    isDgSearch: true,
    updatedAt: value.updatedAt ?? Date.now(),
  };
};

const readRegistry = (): PersistedDockedSearchRegistry => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<
      string,
      PersistedDockedSearchState & { isDgSearch?: boolean }
    >;
    if (!parsed || typeof parsed !== "object") return {};

    const registry: PersistedDockedSearchRegistry = {};
    for (const [key, value] of Object.entries(parsed)) {
      const normalized = normalizeRegistryEntry(key, value);
      if (normalized) {
        registry[normalized.dgSearchId] = normalized;
      }
    }
    return registry;
  } catch {
    return {};
  }
};

const writeRegistry = (registry: PersistedDockedSearchRegistry): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
};

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

  for (const [existingId, entry] of Object.entries(registry)) {
    if (entry.windowId === windowId && existingId !== dgSearchId) {
      delete registry[existingId];
    }
  }

  registry[dgSearchId] = {
    ...state,
    dgSearchId,
    windowId,
    isDgSearch: true,
    updatedAt: Date.now(),
  };
  writeRegistry(registry);
};

export const loadDgSearchWindowById = (
  dgSearchId: string,
): PersistedDockedSearchState | null => readRegistry()[dgSearchId] ?? null;

export const loadDgSearchWindowByWindowId = (
  windowId: string,
): PersistedDockedSearchState | null =>
  listDgSearchWindows().find((state) => state.windowId === windowId) ?? null;

export const remapDgSearchWindowId = ({
  dgSearchId,
  windowId,
}: {
  dgSearchId: string;
  windowId: string;
}): void => {
  const registry = readRegistry();
  const entry = registry[dgSearchId];
  if (!entry) return;

  for (const [existingId, existingEntry] of Object.entries(registry)) {
    if (existingId !== dgSearchId && existingEntry.windowId === windowId) {
      delete registry[existingId];
    }
  }

  registry[dgSearchId] = {
    ...entry,
    windowId,
    updatedAt: Date.now(),
  };
  writeRegistry(registry);
};

export const removeDgSearchWindow = ({
  dgSearchId,
  windowId,
}: {
  dgSearchId?: string;
  windowId?: string;
}): void => {
  const registry = readRegistry();
  let changed = false;

  if (dgSearchId && registry[dgSearchId]) {
    delete registry[dgSearchId];
    changed = true;
  } else if (windowId) {
    const match = Object.entries(registry).find(
      ([, entry]) => entry.windowId === windowId,
    );
    if (match) {
      delete registry[match[0]];
      changed = true;
    }
  }

  if (changed) writeRegistry(registry);
};

export const listDgSearchWindows = (): PersistedDockedSearchState[] =>
  Object.values(readRegistry()).filter((state) => state.isDgSearch);

export const syncDgSearchWindowIdsFromRoam = (
  roamWindows: RoamSidebarWindow[],
): void => {
  const searchQueryWindows = roamWindows.filter(
    (window) => window.type === "search-query",
  );
  const dgEntries = listDgSearchWindows();
  const claimedRoamWindowIds = new Set<string>();

  for (const entry of dgEntries) {
    const matchedById = searchQueryWindows.find(
      (window) => window["window-id"] === entry.windowId,
    );
    if (matchedById) {
      claimedRoamWindowIds.add(matchedById["window-id"]);
    }
  }

  const unmatchedEntries = dgEntries.filter(
    (entry) =>
      !searchQueryWindows.some(
        (window) => window["window-id"] === entry.windowId,
      ),
  );
  const unmatchedRoamWindows = searchQueryWindows.filter(
    (window) => !claimedRoamWindowIds.has(window["window-id"]),
  );

  for (const entry of unmatchedEntries) {
    const queryMatches = unmatchedRoamWindows.filter(
      (window) => window["search-query-str"] === entry.query,
    );
    if (queryMatches.length !== 1) continue;

    const [matchedWindow] = queryMatches;
    remapDgSearchWindowId({
      dgSearchId: entry.dgSearchId,
      windowId: matchedWindow["window-id"],
    });
    claimedRoamWindowIds.add(matchedWindow["window-id"]);
  }
};

export const pruneStaleDockedSearchSidebarStates = async (
  roamWindows?: RoamSidebarWindow[],
): Promise<void> => {
  if (!isRightSidebarOpen()) return;

  const resolvedRoamWindows = roamWindows ?? (await getRoamSidebarWindows());
  syncDgSearchWindowIdsFromRoam(resolvedRoamWindows);

  const roamWindowIds = new Set(
    resolvedRoamWindows.map((window) => window["window-id"]),
  );
  const registry = readRegistry();
  let changed = false;

  for (const dgSearchId of Object.keys(registry)) {
    const entry = registry[dgSearchId];
    if (!entry?.isDgSearch) continue;

    if (roamWindowIds.has(entry.windowId)) continue;

    const sidebarWindow = document.querySelector(
      `[data-sidebar-window-id="${entry.windowId}"]`,
    );
    if (sidebarWindow) continue;

    delete registry[dgSearchId];
    changed = true;
  }

  if (changed) writeRegistry(registry);
};
