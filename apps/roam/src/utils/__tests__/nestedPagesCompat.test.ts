// Backward compatibility: a canvas containing nested sub-page portals must
// still load on a plugin version that predates the feature. Portals persist as
// NATIVE geo shapes carrying meta.dgSubpage, and the page hierarchy as page
// meta — never as a custom shape type, because an unknown shape type makes
// tldraw's loadSnapshot throw and blanks the ENTIRE canvas for old clients.
// These tests simulate an old client (default shape utils only) loading a
// board written by a new client.
import { describe, expect, it } from "vitest";
import {
  createTLStore,
  defaultBindingUtils,
  defaultShapeUtils,
  loadSnapshot,
  type TLGeoShape,
  type TLPage,
  type TLPageId,
  type TLRecord,
  type TLShapeId,
  type TLStore,
  type TLStoreSnapshot,
} from "tldraw";

const PORTAL_ID = "shape:portal" as TLShapeId;
const CHILD_PAGE_ID = "page:child" as TLPageId;

const createOldClientStore = (): TLStore =>
  createTLStore({
    shapeUtils: defaultShapeUtils,
    bindingUtils: defaultBindingUtils,
  });

const newClientRecords = [
  { typeName: "page", id: "page:root", name: "Root", index: "a1", meta: {} },
  {
    typeName: "page",
    id: CHILD_PAGE_ID,
    name: "Child",
    index: "a2",
    meta: {
      dgNested: { parentPageId: "page:root", ownerShapeId: PORTAL_ID },
    },
  },
  {
    typeName: "shape",
    id: PORTAL_ID,
    type: "geo",
    x: 0,
    y: 0,
    rotation: 0,
    index: "a1",
    parentId: "page:root",
    isLocked: false,
    opacity: 1,
    meta: {
      dgSubpage: {
        targetPageId: CHILD_PAGE_ID,
        accent: "#6d5ae0",
        title: "Child",
      },
    },
    props: {
      geo: "rectangle",
      w: 460,
      h: 340,
      color: "violet",
      labelColor: "black",
      fill: "semi",
      dash: "draw",
      size: "m",
      font: "sans",
      text: "⤵ Child",
      align: "middle",
      verticalAlign: "middle",
      growY: 0,
      url: "",
      scale: 1,
    },
  },
] as unknown as TLRecord[];

const buildNewClientSnapshot = (): TLStoreSnapshot => {
  const store = createOldClientStore();
  store.put(newClientRecords);
  const snapshot = store.getStoreSnapshot();
  // New clients stamp migration sequences old clients have never heard of;
  // simulate the worst case explicitly.
  const schema = snapshot.schema as unknown as {
    sequences?: Record<string, number>;
  };
  return {
    ...snapshot,
    schema: {
      ...snapshot.schema,
      sequences: {
        ...(schema.sequences ?? {}),
        "com.roam-research.discourse-graphs.future-feature": 0,
      },
    },
  } as TLStoreSnapshot;
};

describe("old clients reading a nested-pages canvas", () => {
  it("loads a board whose portals are geo shapes with dgSubpage meta", () => {
    const snapshot = buildNewClientSnapshot();
    const oldClient = createOldClientStore();
    expect(() => loadSnapshot(oldClient, snapshot)).not.toThrow();
    const portal = oldClient.get(PORTAL_ID) as TLGeoShape;
    expect(portal.type).toBe("geo");
    expect(portal.meta.dgSubpage).toMatchObject({
      targetPageId: CHILD_PAGE_ID,
    });
    const childPage = oldClient.get(CHILD_PAGE_ID) as TLPage;
    expect(childPage.meta.dgNested).toMatchObject({
      parentPageId: "page:root",
    });
  });

  it("would fail the whole board if portals were a custom shape type (the rejected design)", () => {
    const snapshot = buildNewClientSnapshot();
    const customTypeRecord = {
      typeName: "shape",
      id: "shape:custom",
      type: "dg-subpage",
      x: 0,
      y: 0,
      rotation: 0,
      index: "a2",
      parentId: "page:root",
      isLocked: false,
      opacity: 1,
      meta: {},
      props: { w: 460, h: 340 },
    };
    const withCustomType = {
      ...snapshot,
      store: {
        ...snapshot.store,
        "shape:custom": customTypeRecord,
      },
    } as unknown as TLStoreSnapshot;
    const oldClient = createOldClientStore();
    expect(() => loadSnapshot(oldClient, withCustomType)).toThrow();
  });
});
