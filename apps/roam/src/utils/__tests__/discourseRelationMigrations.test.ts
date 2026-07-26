import { describe, expect, it, vi } from "vitest";

vi.mock("tldraw", () => ({
  createBindingId: () => "binding:mock",
  createMigrationIds: (_sequenceId: string, versions: Record<string, number>) =>
    versions,
  createMigrationSequence: (migrationSequence: unknown) => migrationSequence,
}));

vi.mock("~/components/canvas/DiscourseNodeUtil", () => ({
  DISCOURSE_NODE_SHAPE_TYPE: "discourse-node",
}));

vi.mock(
  "~/components/canvas/DiscourseRelationShape/DiscourseRelationUtil",
  () => ({
    DISCOURSE_RELATION_SHAPE_TYPE: "discourse-relation",
    getRelationColor: () => "grey",
  }),
);

import { migrateRelationTypesToDiscourseRelation } from "~/components/canvas/DiscourseRelationShape/discourseRelationMigrations";

const createArrowLikeShape = ({
  id,
  type,
  text = "Supports",
}: {
  id: string;
  type: string;
  text?: string;
}) => ({
  typeName: "shape",
  id,
  type,
  props: {
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
    arrowheadEnd: "arrow",
    bend: 0,
    labelPosition: 0.5,
    text,
  },
});

const createBinding = ({
  id,
  type,
  fromId,
}: {
  id: string;
  type: string;
  fromId: string;
}) => ({
  typeName: "binding",
  id,
  type,
  fromId,
  toId: "shape:node",
  meta: {},
  props: { terminal: "start" },
});

describe("migrateRelationTypesToDiscourseRelation", () => {
  it("moves known relation type ids to relationTypeId", () => {
    const relationShape = createArrowLikeShape({
      id: "shape:relation",
      type: "rel-uid",
    });
    const relationBinding = createBinding({
      id: "binding:relation",
      type: "rel-uid",
      fromId: relationShape.id,
    });
    const addReferencedShape = createArrowLikeShape({
      id: "shape:add-referenced",
      type: "Add Source",
    });
    const defaultArrowShape = createArrowLikeShape({
      id: "shape:arrow",
      type: "arrow",
    });
    const store = {
      [relationShape.id]: relationShape,
      [relationBinding.id]: relationBinding,
      [addReferencedShape.id]: addReferencedShape,
      [defaultArrowShape.id]: defaultArrowShape,
    };

    migrateRelationTypesToDiscourseRelation({
      oldStore: store,
      allRelationIds: ["rel-uid"],
      allAddReferencedNodeActions: ["Add Source"],
      allNodeTypes: ["claim-node"],
    });

    expect(relationShape.type).toBe("discourse-relation");
    expect(
      (relationShape.props as { relationTypeId?: string }).relationTypeId,
    ).toBe("rel-uid");
    expect(relationBinding.type).toBe("discourse-relation");
    expect(addReferencedShape.type).toBe("Add Source");
    expect(defaultArrowShape.type).toBe("arrow");
  });

  it("migrates unknown arrow-like relation shapes for deleted relation schemas", () => {
    const relationShape = createArrowLikeShape({
      id: "shape:deleted-relation",
      type: "deleted-rel-uid",
    });
    const relationBinding = createBinding({
      id: "binding:deleted-relation",
      type: "deleted-rel-uid",
      fromId: relationShape.id,
    });
    const store = {
      [relationShape.id]: relationShape,
      [relationBinding.id]: relationBinding,
    };

    migrateRelationTypesToDiscourseRelation({
      oldStore: store,
      allRelationIds: [],
      allAddReferencedNodeActions: [],
      allNodeTypes: ["claim-node"],
    });

    expect(relationShape.type).toBe("discourse-relation");
    expect(
      (relationShape.props as { relationTypeId?: string }).relationTypeId,
    ).toBe("deleted-rel-uid");
    expect(relationBinding.type).toBe("discourse-relation");
  });
});
