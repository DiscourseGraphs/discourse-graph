import { describe, expect, it } from "vitest";
import {
  BaseBoxShapeUtil,
  DocumentRecordType,
  PageRecordType,
  IndexKey,
  T,
  TLBaseShape,
  TLDOCUMENT_ID,
  TLFrameShape,
  TLStoreSnapshot,
  createMigrationIds,
  createMigrationSequence,
  createTLStore,
  defaultBindingUtils,
  defaultShapeUtils,
} from "tldraw";
import { buildFrameExportStore } from "~/components/canvas/canvasFrameExportStore";

// The frame snapshot renderer builds its export store with the exact recipe
// the live mount uses (default + custom utils + migration sequences). These
// tests pin the property that makes the static path safe on old data: a
// persisted store holding a legacy node-uid-typed shape (the record family
// behind the 2026-07 blank-page bug) must migrate during load rather than
// throw, and frame parent/child structure must survive so single-frame export
// picks up descendants. Scaffolding mirrors canvasRemoteMerge.test.ts.
const LEGACY_NODE_TYPE = "lxCvhQ034test";
const MIGRATED_NODE_TYPE = "discourse-node-test";

type TestNodeShape = TLBaseShape<
  typeof MIGRATED_NODE_TYPE,
  { w: number; h: number; nodeTypeId: string }
>;

class TestDiscourseNodeUtil extends BaseBoxShapeUtil<TestNodeShape> {
  static override type = MIGRATED_NODE_TYPE;
  static override props = {
    w: T.number,
    h: T.number,
    nodeTypeId: T.string,
  };
  override getDefaultProps() {
    return { w: 100, h: 50, nodeTypeId: "" };
  }
  override component() {
    return null;
  }
  override indicator() {
    return null;
  }
}

const versions = createMigrationIds("com.test.discourse-node", {
  MigrateNodeTypeToDiscourseNode: 1,
});

const testMigrations = createMigrationSequence({
  sequenceId: "com.test.discourse-node",
  retroactive: true,
  sequence: [
    {
      id: versions.MigrateNodeTypeToDiscourseNode,
      scope: "record",
      filter: (r) =>
        r.typeName === "shape" &&
        (r as { type?: string }).type === LEGACY_NODE_TYPE,
      up: (shape) => {
        const s = shape as unknown as {
          type: string;
          props: Record<string, unknown>;
        };
        s.props.nodeTypeId = s.type;
        s.type = MIGRATED_NODE_TYPE;
      },
    },
  ],
});

const PAGE_ID = PageRecordType.createId("page");
const OUTER_FRAME_ID = "shape:frameOuter";
const INNER_FRAME_ID = "shape:frameInner";
const LEGACY_SHAPE_ID = "shape:legacy1";
const NEIGHBOR_SHAPE_ID = "shape:neighbor1";

const baseShape = (
  overrides: Partial<Record<string, unknown>>,
): Record<string, unknown> => ({
  typeName: "shape",
  x: 0,
  y: 0,
  rotation: 0,
  isLocked: false,
  opacity: 1,
  meta: {},
  parentId: PAGE_ID,
  ...overrides,
});

const makeFrameShape = (
  id: string,
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> =>
  baseShape({
    id,
    type: "frame",
    index: "a2",
    props: { w: 400, h: 300, name: "Frame" },
    ...overrides,
  });

const makeLegacyShape = (
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> =>
  baseShape({
    id: LEGACY_SHAPE_ID,
    type: LEGACY_NODE_TYPE,
    index: "a1",
    props: { w: 100, h: 50 },
    ...overrides,
  });

// A persisted snapshot the way Roam block props hold it: records saved before
// the discourse migration sequence existed, so legacy-typed shapes are raw.
const makePersistedSnapshot = (
  records: Record<string, unknown>[],
): TLStoreSnapshot => {
  const scratch = createTLStore({
    shapeUtils: defaultShapeUtils,
    bindingUtils: defaultBindingUtils,
  });
  scratch.put([
    DocumentRecordType.create({ id: TLDOCUMENT_ID }),
    PageRecordType.create({
      id: PAGE_ID,
      name: "Page 1",
      index: "a1" as IndexKey,
    }),
  ]);
  const snapshot = scratch.getStoreSnapshot();
  const store = { ...snapshot.store } as Record<string, unknown>;
  for (const record of records) {
    store[record.id as string] = record;
  }
  return {
    store: store as TLStoreSnapshot["store"],
    schema: snapshot.schema,
  };
};

const exportDeps = {
  migrations: [testMigrations],
  customShapeUtils: [TestDiscourseNodeUtil],
  customBindingUtils: [],
};

describe("buildFrameExportStore", () => {
  it("migrates a legacy node-uid-typed child of a frame during load", () => {
    const snapshot = makePersistedSnapshot([
      makeFrameShape(OUTER_FRAME_ID),
      makeLegacyShape({ parentId: OUTER_FRAME_ID }),
    ]);

    const store = buildFrameExportStore({ snapshot, ...exportDeps });

    const migrated = store.get(
      LEGACY_SHAPE_ID as Parameters<typeof store.get>[0],
    ) as unknown as {
      type: string;
      parentId: string;
      props: { nodeTypeId: string };
    };
    expect(migrated.type).toBe(MIGRATED_NODE_TYPE);
    expect(migrated.props.nodeTypeId).toBe(LEGACY_NODE_TYPE);
    expect(migrated.parentId).toBe(OUTER_FRAME_ID);
  });

  it("preserves a nested-frame parentId chain (what single-frame export walks)", () => {
    const snapshot = makePersistedSnapshot([
      makeFrameShape(OUTER_FRAME_ID),
      makeFrameShape(INNER_FRAME_ID, {
        parentId: OUTER_FRAME_ID,
        index: "a1",
        props: { w: 200, h: 150, name: "Inner" },
      }),
      makeLegacyShape({ parentId: INNER_FRAME_ID }),
      makeFrameShape(NEIGHBOR_SHAPE_ID, {
        index: "a3",
        props: { w: 100, h: 100, name: "Neighbor" },
      }),
    ]);

    const store = buildFrameExportStore({ snapshot, ...exportDeps });

    const shapeAt = (id: string) =>
      store.get(id as Parameters<typeof store.get>[0]) as unknown as {
        parentId: string;
      };
    expect(shapeAt(INNER_FRAME_ID).parentId).toBe(OUTER_FRAME_ID);
    expect(shapeAt(LEGACY_SHAPE_ID).parentId).toBe(INNER_FRAME_ID);
    // The out-of-frame neighbor stays in the store (arrows bound to it keep
    // rendering); export excludes it by walking the frame's descendants, not
    // by store filtering.
    expect(shapeAt(NEIGHBOR_SHAPE_ID).parentId).toBe(PAGE_ID);
    const outer = store.get(
      OUTER_FRAME_ID as Parameters<typeof store.get>[0],
    ) as TLFrameShape | undefined;
    expect(outer?.type).toBe("frame");
  });

  // Documents why buildFrameExportDeps must supply real migrations/utils: the
  // same persisted data without them fails schema validation on load — the
  // pre-fix blank-page failure mode.
  it("throws on legacy data when the migration sequence is missing", () => {
    const snapshot = makePersistedSnapshot([
      makeFrameShape(OUTER_FRAME_ID),
      makeLegacyShape({ parentId: OUTER_FRAME_ID }),
    ]);

    expect(() =>
      buildFrameExportStore({
        snapshot,
        migrations: [],
        customShapeUtils: [],
        customBindingUtils: [],
      }),
    ).toThrow();
  });
});
