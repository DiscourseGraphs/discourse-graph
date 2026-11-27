import { describe, expect, it, vi, afterEach } from "vitest";
import {
  getCanvasCompatibilityMessage,
  readCompatibleLocalCanvas,
} from "~/utils/canvasCompatibility";
import type { json } from "~/utils/getBlockProps";
import { appendCanvasImport } from "~/utils/appendCanvasImport";
import type { TLPageId } from "tldraw";

const documentWith = (value: json): Record<string, json> => ({
  "document:document": {
    typeName: "document",
    meta: { canvasCompatibilityVersion: value },
  },
});
const updateMessage =
  "This canvas was updated by a newer version of Discourse Graphs. Update the extension to open it.";

describe("canvas compatibility", () => {
  it.each([
    undefined,
    {},
    { "document:document": { typeName: "document" } },
    { store: {}, schema: {} },
    {
      store: { "document:document": { meta: { anotherKey: true } } },
      schema: {},
    },
  ])("accepts an unmarked canvas", (snapshot) => {
    expect(
      getCanvasCompatibilityMessage(snapshot as json | undefined),
    ).toBeNull();
  });
  it.each([0, 1, 23])(
    "checks version %i in raw records and wrapped snapshots",
    (version) => {
      const records = documentWith(version);
      for (const snapshot of [records, { store: records, schema: {} }]) {
        expect(getCanvasCompatibilityMessage(snapshot)).toBe(
          version === 0 ? null : updateMessage,
        );
      }
    },
  );
  it.each([null, false, "1", -1, 0.5, Number.MAX_SAFE_INTEGER + 1, [], {}])(
    "rejects a malformed version (%j)",
    (value) => {
      expect(getCanvasCompatibilityMessage(documentWith(value))).toMatch(
        /invalid compatibility version/,
      );
    },
  );
  it.each([
    { "document:document": null },
    { "document:document": { meta: "unreadable" } },
  ])("rejects a malformed document or metadata", (snapshot) => {
    expect(getCanvasCompatibilityMessage(snapshot)).toMatch(
      /invalid compatibility version/,
    );
  });
});

describe("Send to canvas", () => {
  const pageId = "page:one" as TLPageId;
  const page = { id: pageId, typeName: "page" };
  const stored = (version: number) => ({
    ":unrelated": "keep",
    ":roamjs-query-builder": {
      ":stateId": "initial",
      ":extra": true,
      ":tldraw": {
        ":schema": { ":schemaVersion": 2 },
        ":store": { ...documentWith(version), [pageId]: page },
      },
    },
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("rejects a target promoted during import preparation", async () => {
    const pull = vi
      .fn()
      .mockReturnValueOnce({ ":block/props": stored(0) })
      .mockReturnValue({ ":block/props": stored(1) });
    const updateBlock = vi.fn();
    vi.stubGlobal("window", { roamAlphaAPI: { pull, updateBlock } });
    readCompatibleLocalCanvas("target");
    await expect(
      appendCanvasImport({ pageUid: "target", parentId: pageId, shapes: {} }),
    ).rejects.toThrow(updateMessage);
    expect(updateBlock).not.toHaveBeenCalled();
  });
  it("appends to the latest snapshot and keeps the target's metadata", async () => {
    const props = stored(0);
    const existing = { id: "shape:concurrent", typeName: "shape" };
    const saved = props[":roamjs-query-builder"][":tldraw"];
    Object.assign(saved[":store"], { [existing.id]: existing });
    const updateBlock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", {
      roamAlphaAPI: { pull: () => ({ ":block/props": props }), updateBlock },
    });
    const shapes = {
      "shape:imported": { id: "shape:imported", typeName: "shape" as const },
    } as Parameters<typeof appendCanvasImport>[0]["shapes"];
    await expect(
      appendCanvasImport({ pageUid: "target", parentId: pageId, shapes }),
    ).resolves.toBe(true);
    expect(updateBlock.mock.calls[0]?.[0]).toMatchObject({
      block: {
        uid: "target",
        props: {
          unrelated: "keep",
          "roamjs-query-builder": {
            extra: true,
            tldraw: {
              schema: { schemaVersion: 2 },
              store: {
                ...documentWith(0),
                [pageId]: page,
                [existing.id]: existing,
                ...shapes,
              },
            },
          },
        },
      },
    });
  });
  it("does not recreate a destination page removed during preparation", async () => {
    const updateBlock = vi.fn();
    vi.stubGlobal("window", {
      roamAlphaAPI: { pull: () => ({}), updateBlock },
    });
    await expect(
      appendCanvasImport({ pageUid: "target", parentId: pageId, shapes: {} }),
    ).resolves.toBe(false);
    expect(updateBlock).not.toHaveBeenCalled();
  });
});
