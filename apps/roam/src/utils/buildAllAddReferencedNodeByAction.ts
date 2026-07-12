// Maps "Add <Source>" tool actions to the node formats that reference that
// source (e.g. a Claim format containing {Source}). Extracted from the
// TldrawCanvas component so headless canvas consumers (the frame snapshot
// renderer) can build the same custom shape/binding utils without mounting
// the editor.
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import type { AddReferencedNodeType } from "~/components/canvas/DiscourseRelationShape/DiscourseRelationTool";

export const buildAllAddReferencedNodeByAction = (
  allNodes: DiscourseNode[],
): AddReferencedNodeType => {
  const obj: AddReferencedNodeType = {};

  // TODO: support multiple referenced node
  // with migration from format to specification
  allNodes.forEach((n) => {
    const referencedNodes = [...n.format.matchAll(/{([\w\d-]+)}/g)].filter(
      (match) => match[1] !== "content",
    );

    if (referencedNodes.length > 0) {
      const sourceName = referencedNodes[0][1];
      const sourceType = allNodes.find((node) => node.text === sourceName)
        ?.type as string;

      if (!obj[`Add ${sourceName}`]) obj[`Add ${sourceName}`] = [];

      obj[`Add ${sourceName}`].push({
        format: n.format,
        sourceName,
        sourceType,
        destinationType: n.type,
        destinationName: n.text,
      });
    }
  });

  return obj;
};
