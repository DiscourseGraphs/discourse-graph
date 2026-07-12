import type {
  Editor,
  TLRecord,
  TLSessionStateSnapshot,
  TLStoreEventInfo,
} from "tldraw";

const CANVAS_SESSION_STORAGE_VERSION = 1;
const CANVAS_SESSION_STORAGE_PREFIX = "dg:tldraw-session";
const CANVAS_SESSION_SAVE_DELAY_MS = 750;

type CanvasSessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type StoredCanvasSessionState = {
  version: typeof CANVAS_SESSION_STORAGE_VERSION;
  savedAt: number;
  session: TLSessionStateSnapshot;
};

type UnknownRecordChange = [TLRecord, TLRecord];

const encodeStoragePart = (value: string): string => encodeURIComponent(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isCameraState = (
  value: unknown,
): value is TLSessionStateSnapshot["pageStates"][number]["camera"] => {
  return (
    typeof value === "object" &&
    value !== null &&
    isFiniteNumber((value as { x?: unknown }).x) &&
    isFiniteNumber((value as { y?: unknown }).y) &&
    isFiniteNumber((value as { z?: unknown }).z)
  );
};

const isPageState = (
  value: unknown,
): value is TLSessionStateSnapshot["pageStates"][number] => {
  if (typeof value !== "object" || value === null) return false;
  const pageState = value as Record<string, unknown>;
  return (
    typeof pageState.pageId === "string" &&
    isCameraState(pageState.camera) &&
    isStringArray(pageState.selectedShapeIds) &&
    (pageState.focusedGroupId === null ||
      typeof pageState.focusedGroupId === "string")
  );
};

const isCanvasSessionState = (
  value: unknown,
): value is TLSessionStateSnapshot => {
  if (typeof value !== "object" || value === null) return false;
  const session = value as Record<string, unknown>;
  return (
    isFiniteNumber(session.version) &&
    typeof session.currentPageId === "string" &&
    typeof session.isFocusMode === "boolean" &&
    typeof session.exportBackground === "boolean" &&
    typeof session.isDebugMode === "boolean" &&
    typeof session.isToolLocked === "boolean" &&
    typeof session.isGridMode === "boolean" &&
    Array.isArray(session.pageStates) &&
    session.pageStates.every(isPageState)
  );
};

const isStoredCanvasSessionState = (
  value: unknown,
): value is StoredCanvasSessionState => {
  if (typeof value !== "object" || value === null) return false;
  const stored = value as Record<string, unknown>;
  return (
    stored.version === CANVAS_SESSION_STORAGE_VERSION &&
    isFiniteNumber(stored.savedAt) &&
    isCanvasSessionState(stored.session)
  );
};

const isCameraRecord = (record: TLRecord | undefined): boolean =>
  record?.typeName === "camera";

const getCanvasSessionStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const getCanvasSessionStorageKey = ({
  graphName,
  userUid,
  pageUid,
  instanceKey,
}: {
  graphName: string;
  userUid: string;
  pageUid: string;
  // Optional per-embed discriminator (the embed's block uid). When present, the
  // viewport is remembered per embed instance instead of per canvas page, so two
  // embeds of the same canvas hold independent viewports. Omitted for main-page
  // and sidebar canvases, keeping their storage key (and behavior) unchanged.
  instanceKey?: string;
}): string => {
  const parts = [
    CANVAS_SESSION_STORAGE_PREFIX,
    `v${CANVAS_SESSION_STORAGE_VERSION}`,
    encodeStoragePart(graphName),
    encodeStoragePart(userUid || "anonymous"),
    encodeStoragePart(pageUid),
  ];
  if (instanceKey) parts.push(encodeStoragePart(instanceKey));
  return parts.join(":");
};

export const readCanvasSessionState = ({
  storage,
  storageKey,
}: {
  storage: CanvasSessionStorage;
  storageKey: string;
}): TLSessionStateSnapshot | null => {
  const raw = storage.getItem(storageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isStoredCanvasSessionState(parsed)) return parsed.session;
  } catch {
    // Remove invalid stored state below.
  }

  storage.removeItem(storageKey);
  return null;
};

export const getValidCanvasSessionState = ({
  session,
  pageIds,
  currentPageId,
}: {
  session: TLSessionStateSnapshot;
  pageIds: readonly string[];
  currentPageId: TLSessionStateSnapshot["currentPageId"];
}): TLSessionStateSnapshot | null => {
  const pageIdSet = new Set(pageIds);
  const pageStates = session.pageStates.filter((pageState) =>
    pageIdSet.has(pageState.pageId),
  );

  if (
    pageIdSet.has(session.currentPageId) &&
    pageStates.some((pageState) => pageState.pageId === session.currentPageId)
  ) {
    return {
      ...session,
      pageStates,
    };
  }

  if (pageIds.length !== 1 || !session.pageStates[0]) return null;

  return {
    ...session,
    currentPageId,
    pageStates: [
      {
        ...session.pageStates[0],
        pageId: currentPageId,
        selectedShapeIds: [],
        focusedGroupId: null,
      },
    ],
  };
};

export const hasCameraRecordChange = (entry: TLStoreEventInfo): boolean => {
  const changedRecords = [
    ...Object.values(entry.changes.added),
    ...Object.values(entry.changes.removed),
    ...Object.values(entry.changes.updated).flatMap(
      (change) => change as UnknownRecordChange,
    ),
  ];
  return changedRecords.some(isCameraRecord);
};

const restoreCanvasSessionState = ({
  editor,
  storage,
  storageKey,
}: {
  editor: Editor;
  storage: CanvasSessionStorage;
  storageKey: string;
}): void => {
  const session = readCanvasSessionState({ storage, storageKey });
  if (!session) return;

  const validSession = getValidCanvasSessionState({
    session,
    pageIds: editor.getPages().map((page) => page.id),
    currentPageId: editor.getCurrentPageId(),
  });

  if (!validSession) {
    storage.removeItem(storageKey);
    return;
  }

  try {
    editor.loadSnapshot({ session: validSession });
  } catch {
    storage.removeItem(storageKey);
  }
};

const saveCanvasSessionState = ({
  editor,
  storage,
  storageKey,
}: {
  editor: Editor;
  storage: CanvasSessionStorage;
  storageKey: string;
}): void => {
  try {
    const { session } = editor.getSnapshot();
    const stored: StoredCanvasSessionState = {
      version: CANVAS_SESSION_STORAGE_VERSION,
      savedAt: Date.now(),
      session,
    };
    storage.setItem(storageKey, JSON.stringify(stored));
  } catch {
    // Session persistence should never block normal canvas interaction.
  }
};

export const registerCanvasSessionStatePersistence = ({
  editor,
  graphName,
  userUid,
  pageUid,
  instanceKey,
  storage = getCanvasSessionStorage(),
  saveDelayMs = CANVAS_SESSION_SAVE_DELAY_MS,
}: {
  editor: Editor;
  graphName: string;
  userUid: string;
  pageUid: string;
  instanceKey?: string;
  storage?: CanvasSessionStorage | null;
  saveDelayMs?: number;
}): (() => void) => {
  if (!storage) return () => {};

  const storageKey = getCanvasSessionStorageKey({
    graphName,
    userUid,
    pageUid,
    instanceKey,
  });
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  const flushPendingSave = (): void => {
    if (!saveTimeout) return;
    clearTimeout(saveTimeout);
    saveTimeout = null;
    saveCanvasSessionState({ editor, storage, storageKey });
  };

  restoreCanvasSessionState({ editor, storage, storageKey });

  const stopListening = editor.store.listen(
    (entry) => {
      if (!hasCameraRecordChange(entry)) return;
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveTimeout = null;
        saveCanvasSessionState({ editor, storage, storageKey });
      }, saveDelayMs);
    },
    { source: "user", scope: "session" },
  );

  return () => {
    stopListening();
    flushPendingSave();
  };
};
