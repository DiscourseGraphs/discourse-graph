import { describe, expect, it, vi } from "vitest";
import type {
  TLRecord,
  TLSessionStateSnapshot,
  TLStoreEventInfo,
} from "tldraw";
import {
  getCanvasSessionStorageKey,
  getValidCanvasSessionState,
  hasCameraRecordChange,
  readCanvasSessionState,
} from "~/utils/canvasSessionState";

type TestStorage = Pick<Storage, "getItem" | "setItem" | "removeItem"> & {
  values: Map<string, string>;
};

const createStorage = (initialValues: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initialValues));
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
  } satisfies TestStorage;
};

const createSession = ({
  currentPageId = "page:current",
  pageId = currentPageId,
}: {
  currentPageId?: string;
  pageId?: string;
} = {}): TLSessionStateSnapshot =>
  ({
    version: 0,
    currentPageId,
    isFocusMode: false,
    exportBackground: true,
    isDebugMode: false,
    isToolLocked: false,
    isGridMode: false,
    pageStates: [
      {
        pageId,
        camera: {
          x: 120,
          y: -40,
          z: 1.5,
        },
        selectedShapeIds: ["shape:selected"],
        focusedGroupId: "shape:focused",
      },
    ],
  }) as TLSessionStateSnapshot;

const createCameraRecord = (z: number): TLRecord =>
  ({
    id: "camera:page",
    typeName: "camera",
    x: 0,
    y: 0,
    z,
    meta: {},
  }) as TLRecord;

describe("getCanvasSessionStorageKey", () => {
  it("scopes viewport state by graph, user, and canvas page", () => {
    expect(
      getCanvasSessionStorageKey({
        graphName: "graph/name",
        userUid: "user:1",
        pageUid: "abc 123",
      }),
    ).toBe("dg:tldraw-session:v1:graph%2Fname:user%3A1:abc%20123");
  });

  it("appends an instance key so embeds of the same page stay independent", () => {
    expect(
      getCanvasSessionStorageKey({
        graphName: "graph/name",
        userUid: "user:1",
        pageUid: "abc 123",
        instanceKey: "block-uid-1",
      }),
    ).toBe("dg:tldraw-session:v1:graph%2Fname:user%3A1:abc%20123:block-uid-1");
  });

  it("is unchanged from the base key when no instance key is given", () => {
    const base = getCanvasSessionStorageKey({
      graphName: "g",
      userUid: "u",
      pageUid: "p",
    });
    const withUndefined = getCanvasSessionStorageKey({
      graphName: "g",
      userUid: "u",
      pageUid: "p",
      instanceKey: undefined,
    });
    expect(withUndefined).toBe(base);
  });
});

describe("readCanvasSessionState", () => {
  it("reads a valid stored tldraw session snapshot", () => {
    const session = createSession();
    const storage = createStorage({
      canvas: JSON.stringify({
        version: 1,
        savedAt: 1,
        session,
      }),
    });

    expect(readCanvasSessionState({ storage, storageKey: "canvas" })).toEqual(
      session,
    );
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it("removes malformed stored session state", () => {
    const storage = createStorage({ canvas: "{not-json" });

    expect(
      readCanvasSessionState({ storage, storageKey: "canvas" }),
    ).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith("canvas");
    expect(storage.values.has("canvas")).toBe(false);
  });
});

describe("getValidCanvasSessionState", () => {
  it("keeps a session snapshot when the saved page still exists", () => {
    const session = createSession();

    const result = getValidCanvasSessionState({
      session,
      pageIds: ["page:current"],
      currentPageId: "page:current" as TLSessionStateSnapshot["currentPageId"],
    });

    expect(result).toEqual(session);
  });

  it("remaps a one-page canvas session to the current page id", () => {
    const session = createSession({
      currentPageId: "page:old",
      pageId: "page:old",
    });

    const result = getValidCanvasSessionState({
      session,
      pageIds: ["page:new"],
      currentPageId: "page:new" as TLSessionStateSnapshot["currentPageId"],
    });

    expect(result?.currentPageId).toBe("page:new");
    expect(result?.pageStates[0]?.pageId).toBe("page:new");
    expect(result?.pageStates[0]?.camera).toEqual({
      x: 120,
      y: -40,
      z: 1.5,
    });
    expect(result?.pageStates[0]?.selectedShapeIds).toEqual([]);
    expect(result?.pageStates[0]?.focusedGroupId).toBeNull();
  });

  it("drops a stale session when a multipage document cannot be matched", () => {
    const session = createSession({
      currentPageId: "page:old",
      pageId: "page:old",
    });

    expect(
      getValidCanvasSessionState({
        session,
        pageIds: ["page:a", "page:b"],
        currentPageId: "page:a" as TLSessionStateSnapshot["currentPageId"],
      }),
    ).toBeNull();
  });
});

describe("hasCameraRecordChange", () => {
  it("detects camera records in session changes", () => {
    expect(
      hasCameraRecordChange({
        source: "user",
        changes: {
          added: {},
          removed: {},
          updated: {
            "camera:page": [createCameraRecord(1), createCameraRecord(2)],
          },
        },
      } as TLStoreEventInfo),
    ).toBe(true);
  });

  it("ignores non-camera session changes", () => {
    expect(
      hasCameraRecordChange({
        source: "user",
        changes: {
          added: {
            "instance:page": {
              id: "instance:page",
              typeName: "instance_page_state",
            } as TLRecord,
          },
          removed: {},
          updated: {},
        },
      } as TLStoreEventInfo),
    ).toBe(false);
  });
});
