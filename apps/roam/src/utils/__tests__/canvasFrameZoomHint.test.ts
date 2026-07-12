import { describe, expect, it } from "vitest";
import {
  consumeFrameZoomHint,
  writeFrameZoomHint,
} from "~/utils/canvasFrameZoomHint";

const makeStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    size: () => map.size,
    raw: map,
  };
};

const PAGE_UID = "abc123def";
const KEY = `dg-canvas:zoom-to-frame:${PAGE_UID}`;

describe("canvasFrameZoomHint", () => {
  it("round-trips a frame ref through write and consume", () => {
    const storage = makeStorage();
    writeFrameZoomHint({
      pageUid: PAGE_UID,
      frame: { name: "Frame A", shapeId: "shape:x1" },
      storage,
      now: 1000,
    });
    expect(
      consumeFrameZoomHint({ pageUid: PAGE_UID, storage, now: 2000 }),
    ).toEqual({ name: "Frame A", shapeId: "shape:x1" });
  });

  it("is one-shot: the second consume returns null", () => {
    const storage = makeStorage();
    writeFrameZoomHint({
      pageUid: PAGE_UID,
      frame: { shapeId: "shape:x1" },
      storage,
      now: 1000,
    });
    expect(
      consumeFrameZoomHint({ pageUid: PAGE_UID, storage, now: 1001 }),
    ).toEqual({ shapeId: "shape:x1" });
    expect(
      consumeFrameZoomHint({ pageUid: PAGE_UID, storage, now: 1002 }),
    ).toBeNull();
    expect(storage.size()).toBe(0);
  });

  it("is scoped per canvas page", () => {
    const storage = makeStorage();
    writeFrameZoomHint({
      pageUid: PAGE_UID,
      frame: { shapeId: "shape:x1" },
      storage,
      now: 1000,
    });
    expect(
      consumeFrameZoomHint({ pageUid: "otherPage", storage, now: 1001 }),
    ).toBeNull();
    // The other page's consume must not have destroyed this page's hint.
    expect(
      consumeFrameZoomHint({ pageUid: PAGE_UID, storage, now: 1002 }),
    ).toEqual({ shapeId: "shape:x1" });
  });

  it("expires stale hints instead of zooming long after the click", () => {
    const storage = makeStorage();
    writeFrameZoomHint({
      pageUid: PAGE_UID,
      frame: { name: "Frame A" },
      storage,
      now: 1000,
    });
    expect(
      consumeFrameZoomHint({
        pageUid: PAGE_UID,
        storage,
        now: 1000 + 2 * 60 * 1000 + 1,
      }),
    ).toBeNull();
  });

  it("clears and ignores corrupt or shapeless stored values", () => {
    const storage = makeStorage();
    storage.setItem(KEY, "not json {");
    expect(
      consumeFrameZoomHint({ pageUid: PAGE_UID, storage, now: 1000 }),
    ).toBeNull();
    expect(storage.size()).toBe(0);

    storage.setItem(KEY, JSON.stringify({ savedAt: 999 }));
    expect(
      consumeFrameZoomHint({ pageUid: PAGE_UID, storage, now: 1000 }),
    ).toBeNull();
    expect(storage.size()).toBe(0);
  });

  it("skips writing a hint with no name or shape id", () => {
    const storage = makeStorage();
    writeFrameZoomHint({ pageUid: PAGE_UID, frame: {}, storage, now: 1000 });
    expect(storage.size()).toBe(0);
  });

  it("never throws when storage is unavailable", () => {
    expect(() =>
      writeFrameZoomHint({
        pageUid: PAGE_UID,
        frame: { name: "Frame A" },
        storage: null,
        now: 1000,
      }),
    ).not.toThrow();
    expect(
      consumeFrameZoomHint({ pageUid: PAGE_UID, storage: null, now: 1000 }),
    ).toBeNull();
  });
});
