import { describe, expect, it } from "vitest";
import { buildAllAddReferencedNodeByAction } from "~/utils/buildAllAddReferencedNodeByAction";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";

const makeNode = (overrides: Partial<DiscourseNode>): DiscourseNode =>
  ({
    text: "Node",
    type: "node-type",
    shortcut: "N",
    specification: [],
    backedBy: "user",
    canvasSettings: {},
    format: "[[NOD]] - {content}",
    ...overrides,
  }) as DiscourseNode;

describe("buildAllAddReferencedNodeByAction", () => {
  it("maps formats referencing another node to an Add <Source> action", () => {
    const source = makeNode({
      text: "Source",
      type: "source-type",
      format: "[[SRC]] - {content}",
    });
    const claim = makeNode({
      text: "Claim",
      type: "claim-type",
      format: "[[CLM]] - {Source} - {content}",
    });

    const actions = buildAllAddReferencedNodeByAction([source, claim]);

    expect(Object.keys(actions)).toEqual(["Add Source"]);
    expect(actions["Add Source"]).toEqual([
      {
        format: claim.format,
        sourceName: "Source",
        sourceType: "source-type",
        destinationType: "claim-type",
        destinationName: "Claim",
      },
    ]);
  });

  it("ignores {content} placeholders and formats with no reference", () => {
    const plain = makeNode({ format: "[[EVD]] - {content}" });
    expect(buildAllAddReferencedNodeByAction([plain])).toEqual({});
  });

  it("groups multiple destinations under one shared source action", () => {
    const source = makeNode({
      text: "Source",
      type: "source-type",
      format: "[[SRC]] - {content}",
    });
    const claim = makeNode({
      text: "Claim",
      type: "claim-type",
      format: "[[CLM]] - {Source} - {content}",
    });
    const question = makeNode({
      text: "Question",
      type: "question-type",
      format: "[[QUE]] - {Source} - {content}",
    });

    const actions = buildAllAddReferencedNodeByAction([
      source,
      claim,
      question,
    ]);

    expect(actions["Add Source"]).toHaveLength(2);
    expect(
      actions["Add Source"].map((action) => action.destinationName),
    ).toEqual(["Claim", "Question"]);
  });
});
