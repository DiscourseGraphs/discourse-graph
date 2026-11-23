import { describe, expect, it, vi } from "vitest";
import type { Editor, TLShapeId } from "tldraw";
import { getValidRelationTypesBetween } from "~/components/canvas/overlays/relationCreation";

const mocks = vi.hoisted(() => ({
  relations: [] as {
    id: string;
    label: string;
    complement: string;
    source: string;
    destination: string;
  }[],
}));

vi.mock(
  "~/components/canvas/DiscourseRelationShape/DiscourseRelationUtil",
  () => ({
    BaseDiscourseRelationUtil: class {},
    getRelationColor: () => "grey",
  }),
);
vi.mock("~/components/canvas/DiscourseRelationShape/helpers", () => ({
  createOrUpdateArrowBinding: vi.fn(),
}));
vi.mock("~/components/canvas/DiscourseNodeUtil", () => ({
  getDiscourseNodeTypeId: ({ shape }: { shape: { props: { t: string } } }) =>
    shape.props.t,
}));
vi.mock("~/components/canvas/canvasUtils", () => ({
  getCreatableRelations: () => mocks.relations,
  isDiscourseNodeShape: () => true,
}));
vi.mock("~/components/canvas/ToastListener", () => ({
  dispatchToastEvent: vi.fn(),
}));

const relation = (id: string, label: string) => ({
  id,
  label,
  complement: `${label} by`,
  source: "A",
  destination: "B",
});

const editorWith = (registered: string[]): Editor =>
  ({
    shapeUtils: Object.fromEntries(registered.map((t) => [t, {}])),
    getShape: (id: string) => ({
      id,
      props: { t: id === "shape:a" ? "A" : "B" },
    }),
  }) as unknown as Editor;

describe("getValidRelationTypesBetween", () => {
  it("leaves out relation types the canvas has not registered", () => {
    mocks.relations = [
      relation("rel-old", "supports"),
      relation("rel-new", "informs"),
    ];
    const types = getValidRelationTypesBetween(
      editorWith(["rel-old"]),
      "shape:a" as TLShapeId,
      "shape:b" as TLShapeId,
    );
    expect(types.map((t) => t.id)).toEqual(["rel-old"]);
  });
});
