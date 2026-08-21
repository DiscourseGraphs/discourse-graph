import { describe, expect, it } from "vitest";
import {
  addRelationship,
  deleteNode,
  getSeedNodes,
  type DiscourseNode,
} from "./model";

describe("discourse graph model", () => {
  it("returns a fresh copy of the demo on every reset", () => {
    const firstCopy = getSeedNodes();
    firstCopy[0]?.links.push({
      targetId: "claim-transparency",
      type: "relates_to",
    });

    expect(getSeedNodes()[0]?.links).toEqual([]);
  });

  it("does not create duplicate relationships", () => {
    const nodes = getSeedNodes();
    const updated = addRelationship({
      nodes,
      sourceId: "evidence-registered-reports",
      targetId: "claim-transparency",
      type: "supports",
    });

    expect(
      updated
        .find((node) => node.id === "evidence-registered-reports")
        ?.links.filter((link) => link.targetId === "claim-transparency"),
    ).toHaveLength(1);
  });

  it("reparents children and removes backlinks when a node is deleted", () => {
    const nodes: DiscourseNode[] = [
      {
        id: "parent",
        type: "question",
        text: "Parent",
        parentId: null,
        links: [],
      },
      {
        id: "deleted",
        type: "claim",
        text: "Deleted",
        parentId: "parent",
        links: [],
      },
      {
        id: "child",
        type: "evidence",
        text: "Child",
        parentId: "deleted",
        links: [{ targetId: "deleted", type: "supports" }],
      },
    ];

    const updated = deleteNode({ nodes, nodeId: "deleted" });

    expect(updated.find((node) => node.id === "child")).toMatchObject({
      parentId: "parent",
      links: [],
    });
  });
});
