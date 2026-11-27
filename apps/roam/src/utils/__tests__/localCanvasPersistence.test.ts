// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import {
  createRecordType,
  Store,
  StoreSchema,
  type RecordId,
} from "@tldraw/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRoamStore } from "~/components/canvas/useRoamStore";
import { ensureCanvasSyncMode } from "~/components/canvas/canvasSyncMode";
import type { json } from "~/utils/getBlockProps";

const mocks = vi.hoisted(() => ({
  createStore: vi.fn(),
  load: vi.fn(),
  stateBlock: vi.fn(),
  timestamp: vi.fn(),
  syncMode: vi.fn(),
}));
vi.mock("@tldraw/editor", () => ({ createTLStore: mocks.createStore }));
vi.mock("@tldraw/tlschema", () => ({ TLDOCUMENT_ID: "document:document" }));
vi.mock("tldraw", () => ({
  defaultBindingUtils: [],
  defaultShapeUtils: [],
  loadSnapshot: mocks.load,
}));
vi.mock("roamjs-components/queries/getBasicTreeByParentUid", () => ({
  default: () => [],
}));
vi.mock("roamjs-components/util/getSubTree", () => ({ default: () => ({}) }));
vi.mock("roamjs-components/writes/createBlock", () => ({
  default: mocks.stateBlock,
}));
vi.mock("roamjs-components/util/setInputSetting", () => ({
  default: mocks.timestamp,
}));
vi.mock("~/utils/setBlockProps", () => ({ default: mocks.syncMode }));
vi.mock("~/utils/internalError", () => ({ default: vi.fn() }));

const snapshot = (
  value?: number,
): { store: Record<string, json>; schema: Record<string, json> } => ({
  store: {
    "document:document": {
      typeName: "document",
      id: "document:document",
      meta: value === undefined ? {} : { canvasCompatibilityVersion: value },
    },
  },
  schema: { schemaVersion: 2 },
});
type Props = Record<string, json>;
const propsWith = (tldraw: json, stateId = "peer"): Props => ({
  "roamjs-query-builder": { tldraw, stateId },
  other: "keep",
});
const update =
  vi.fn<(args: { page: { uid: string; props: Props } }) => Promise<void>>();
const applyDiff = vi.fn();
const getSnapshot = vi.fn<() => ReturnType<typeof snapshot>>();
const unlisten = vi.fn();
let localChange: () => void;
let notify: (props: Props) => void;
let props: Props;
let root: Root;
let container: HTMLDivElement;
let latest: ReturnType<typeof useRoamStore>;

const Editor = ({ uid }: { uid: string }): React.ReactElement => {
  latest = useRoamStore({
    pageUid: uid,
    customShapeUtils: [],
    customBindingUtils: [],
    migrations: [],
  });
  return React.createElement(
    "div",
    null,
    latest.compatibilityMessage ?? (latest.store ? "editor" : "legacy"),
  );
};
const open = (uid = "one"): void => {
  act(() => root.render(React.createElement(Editor, { uid, key: uid })));
};
const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  props = {};
  getSnapshot.mockImplementation(() => snapshot());
  const store = {
    _flushHistory: vi.fn(),
    listen: (fn: (change: unknown) => void) => {
      localChange = () =>
        fn({
          source: "user",
          changes: { added: { "shape:edit": {} }, removed: {}, updated: {} },
        });
      return unlisten;
    },
    serialize: () => snapshot().store,
    getSnapshot,
    schema: { serialize: () => ({ schemaVersion: 2 }) },
    mergeRemoteChanges: (fn: () => void) => fn(),
    applyDiff,
  };
  mocks.createStore.mockReturnValue(store);
  update.mockImplementation(({ page }) => {
    props = page.props;
    return Promise.resolve();
  });
  vi.stubGlobal("roamAlphaAPI", {
    pull: () => ({ ":block/props": props }),
    data: {
      page: { update },
      addPullWatch: (
        _pattern: string,
        _entity: string,
        callback: (before: unknown, after: unknown) => void,
      ) => {
        notify = (next) => {
          props = next;
          callback(null, { ":block/props": props });
        };
      },
      removePullWatch: vi.fn(),
    },
  });
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("local canvas persistence", () => {
  it("refuses a newer snapshot before initialization can write anything", () => {
    props = propsWith(snapshot(1));
    open();
    expect(ensureCanvasSyncMode({ pageUid: "one" })).toBe("local");
    expect(container.textContent).toMatch(/Update the extension/);
    expect(mocks.createStore).not.toHaveBeenCalled();
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.stateBlock).not.toHaveBeenCalled();
    expect(mocks.syncMode).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(props).toEqual(propsWith(snapshot(1)));
  });
  it("stops both queued operations even when the promotion echoes a local state ID", async () => {
    props = propsWith(snapshot(0));
    open();
    localChange();
    await settle();
    const saved = props["roamjs-query-builder"] as Record<string, json>;
    expect(update).toHaveBeenCalledTimes(1);
    expect(mocks.timestamp).toHaveBeenCalledTimes(1);
    localChange();
    act(() => notify(propsWith(snapshot(), "peer")));
    const savedId = saved.stateId;
    if (typeof savedId !== "string")
      throw new Error("Expected the local save to assign a state ID");
    act(() => notify(propsWith(snapshot(1), savedId)));
    expect(container.textContent).toMatch(/Update the extension/);
    act(() => notify(propsWith(snapshot(0), "late-compatible-event")));
    await settle();
    expect(update).toHaveBeenCalledTimes(1);
    expect(mocks.timestamp).toHaveBeenCalledTimes(1);
    expect(applyDiff).not.toHaveBeenCalled();
    expect(unlisten).toHaveBeenCalled();
    expect(container.textContent).toMatch(/Update the extension/);
  });
  it("rereads storage before a queued save even before the watch fires", async () => {
    open();
    localChange();
    props = propsWith(snapshot(1));
    await settle();
    expect(update).not.toHaveBeenCalled();
    expect(mocks.timestamp).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/Update the extension/);
  });
  it("rereads storage before applying a delayed peer update", async () => {
    open();
    act(() => notify(propsWith(snapshot())));
    props = propsWith(snapshot(1));
    await settle();
    expect(applyDiff).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/Update the extension/);
  });
  it("skips the timestamp when a promotion arrives during an outstanding write", async () => {
    let finish!: () => void;
    update.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    open();
    localChange();
    await settle();
    act(() => notify(propsWith(snapshot(1))));
    await act(async () => {
      finish();
      await Promise.resolve();
    });
    expect(mocks.timestamp).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/Update the extension/);
  });
  it("preserves an explicit baseline marker on a save before the peer update applies", async () => {
    open();
    localChange();
    props = propsWith(snapshot(0));
    await settle();
    expect(update).toHaveBeenCalledTimes(1);
    expect(props).toMatchObject({
      other: "keep",
      "roamjs-query-builder": { tldraw: snapshot(0) },
    });
  });
  it("applies compatible incoming updates and keeps the page store through a rerender", async () => {
    props = propsWith(snapshot());
    open();
    open();
    act(() => notify(propsWith(snapshot(0))));
    await settle();
    expect(applyDiff).toHaveBeenCalledTimes(1);
    expect(mocks.createStore).toHaveBeenCalledTimes(1);
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });
  it("applies changed document records and leaves personal records and equal nested values alone", async () => {
    const oldShape = {
      id: "shape:changed",
      typeName: "shape",
      props: { color: "red" },
    };
    const newShape = { ...oldShape, props: { color: "blue" } };
    const stable = {
      id: "shape:stable",
      typeName: "shape",
      props: { x: 1, y: 2 },
    };
    const added = { id: "shape:added", typeName: "shape" };
    const removed = { id: "shape:removed", typeName: "shape" };
    const local = snapshot();
    Object.assign(local.store, {
      [oldShape.id]: oldShape,
      [stable.id]: stable,
      [removed.id]: removed,
      "camera:local": { id: "camera:local", typeName: "camera" },
    });
    getSnapshot.mockReturnValue(local);
    const peer = snapshot();
    Object.assign(peer.store, {
      [newShape.id]: newShape,
      [stable.id]: { ...stable, props: { y: 2, x: 1 } },
      [added.id]: added,
    });
    open();
    act(() => notify(propsWith(peer)));
    await settle();
    expect(applyDiff).toHaveBeenCalledWith({
      added: { [added.id]: added },
      removed: { [removed.id]: removed },
      updated: { [newShape.id]: [oldShape, newShape] },
    });
  });

  it("checks storage again when the legacy upgrade button was already visible", async () => {
    props = propsWith(snapshot().store);
    open();
    expect(latest.needsUpgrade).toBe(true);
    props = propsWith(snapshot(1));
    await act(async () => {
      expect(await latest.performUpgrade()).toBe(false);
    });
    expect(container.textContent).toMatch(/Update the extension/);
    expect(update).not.toHaveBeenCalled();
  });
  it("saves an edit when the editor closes before tldraw delivers the next animation frame", () => {
    vi.stubGlobal("__FORCE_RAF_IN_TESTS__", true);
    type Shape = { typeName: "shape"; id: RecordId<Shape>; value: string };
    const shapes = createRecordType<Shape>("shape", { scope: "document" });
    const store = new Store({
      props: {},
      schema: StoreSchema.create({ shape: shapes }),
    });
    mocks.createStore.mockReturnValue(store);
    open();
    const shape = shapes.create({
      id: shapes.createId("last"),
      value: "final edit",
    });
    act(() => {
      store.put([shape]);
      root.render(null);
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(props).toMatchObject({
      "roamjs-query-builder": { tldraw: { store: { [shape.id]: shape } } },
    });
    store.dispose();
  });

  it("checks a pending edit on navigation and starts a separate store for the next page", async () => {
    open();
    localChange();
    open("two");
    await settle();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].page.uid).toBe("one");
    expect(mocks.timestamp).toHaveBeenCalledWith(
      expect.objectContaining({ blockUid: "one" }),
    );
    expect(mocks.createStore).toHaveBeenCalledTimes(2);
    localChange();
    await settle();
    expect(update.mock.calls[1][0].page.uid).toBe("two");
  });
});
