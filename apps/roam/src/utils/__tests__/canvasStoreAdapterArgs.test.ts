import { describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({
  useMemo: <T>(factory: () => T): T => factory(),
}));

vi.mock("~/components/canvas/DiscourseNodeUtil", () => ({
  DiscourseNodeUtil: { type: "discourse-node" },
  createLegacyDiscourseNodeShapeUtils: () => [],
}));

vi.mock(
  "~/components/canvas/DiscourseRelationShape/DiscourseRelationUtil",
  () => ({
    createAllRelationShapeUtils: () => [{ type: "discourse-relation" }],
    createLegacyDiscourseRelationShapeUtils: (relationIds: string[]) =>
      relationIds.map((type) => ({ type })),
    createAllReferencedNodeUtils: () => [],
  }),
);

vi.mock(
  "~/components/canvas/DiscourseRelationShape/DiscourseRelationBindings",
  () => ({
    createAllRelationBindings: () => [{ type: "discourse-relation" }],
    createLegacyRelationBindings: (relationIds: string[]) =>
      relationIds.map((type) => ({ type })),
    createAllReferencedNodeBindings: () => [],
  }),
);

vi.mock(
  "~/components/canvas/DiscourseRelationShape/discourseRelationMigrations",
  () => ({ createMigrations: () => ({}) }),
);

// useMemo is mocked above, so the hook runs as a plain function outside React.
import { useCanvasStoreAdapterArgs as getCanvasStoreAdapterArgs } from "~/components/canvas/useCanvasStoreAdapterArgs";

const getArgs = (isCloudflareSync: boolean) =>
  getCanvasStoreAdapterArgs({
    pageUid: "page-uid",
    isCloudflareSync,
    allNodes: [],
    allRelationIds: ["relation-uid-1", "relation-uid-2"],
    allAddReferencedNodeByAction: {},
  });

describe("useCanvasStoreAdapterArgs relation types", () => {
  it("registers legacy relation-id shape and binding types for cloud rooms", () => {
    const { customShapeTypes, customBindingTypes } = getArgs(true);

    expect(customShapeTypes).toEqual(
      expect.arrayContaining([
        "discourse-relation",
        "relation-uid-1",
        "relation-uid-2",
      ]),
    );
    expect(customBindingTypes).toEqual([
      "discourse-relation",
      "relation-uid-1",
      "relation-uid-2",
    ]);
  });

  it("registers only discourse-relation for local canvases", () => {
    const { customShapeTypes, customBindingTypes } = getArgs(false);

    expect(customShapeTypes).toContain("discourse-relation");
    expect(customShapeTypes).not.toContain("relation-uid-1");
    expect(customBindingTypes).toEqual(["discourse-relation"]);
  });
});
