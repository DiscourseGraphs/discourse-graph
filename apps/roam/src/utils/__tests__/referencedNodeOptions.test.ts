import { describe, expect, it } from "vitest";
import type { AddReferencedNodeType } from "~/components/canvas/DiscourseRelationShape/DiscourseRelationTool";
import { getValidReferencedNodeActionOptions } from "~/components/canvas/overlays/referencedNodeOptions";

const actionMap: AddReferencedNodeType = {
  "Add Source": [
    {
      format: "[[EVD]] - {content} - {Source}",
      sourceName: "Source",
      sourceType: "_SRC-node",
      destinationType: "_EVD-node",
      destinationName: "Evidence",
    },
  ],
  "Add Reference": [
    {
      format: "[[CLM]] - {content} - {Source}",
      sourceName: "Source",
      sourceType: "_SRC-node",
      destinationType: "_CLM-node",
      destinationName: "Claim",
    },
    {
      format: "[[ARG]] - {content} - {Source}",
      sourceName: "Source",
      sourceType: "_SRC-node",
      destinationType: "_CLM-node",
      destinationName: "Claim",
    },
  ],
};

describe("referenced node relation options", () => {
  it("allows source nodes to add sources to evidence", () => {
    expect(
      getValidReferencedNodeActionOptions({
        allAddReferencedNodeByAction: actionMap,
        sourceNodeType: "_SRC-node",
        targetNodeType: "_EVD-node",
      }).map((option) => option.id),
    ).toEqual(["Add Source"]);
  });

  it("does not allow evidence nodes to add sources to source nodes", () => {
    expect(
      getValidReferencedNodeActionOptions({
        allAddReferencedNodeByAction: actionMap,
        sourceNodeType: "_EVD-node",
        targetNodeType: "_SRC-node",
      }),
    ).toEqual([]);
  });

  it("does not show source actions for incompatible targets", () => {
    expect(
      getValidReferencedNodeActionOptions({
        allAddReferencedNodeByAction: actionMap,
        sourceNodeType: "_SRC-node",
        targetNodeType: "_QUE-node",
      }),
    ).toEqual([]);
  });

  it("returns one option when an action has multiple compatible formats", () => {
    const options = getValidReferencedNodeActionOptions({
      allAddReferencedNodeByAction: actionMap,
      sourceNodeType: "_SRC-node",
      targetNodeType: "_CLM-node",
    });

    expect(options).toHaveLength(1);
    expect(options[0]?.id).toBe("Add Reference");
    expect(options[0]?.references).toHaveLength(2);
  });
});
