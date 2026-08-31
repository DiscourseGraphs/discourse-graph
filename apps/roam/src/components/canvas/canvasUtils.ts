import { Editor, TLShape } from "tldraw";
import {
  DiscourseNodeUtil,
  DiscourseNodeShape,
} from "~/components/canvas/DiscourseNodeUtil";
import { discourseContext } from "~/components/canvas/Tldraw";

export const isDiscourseNodeShape = (
  editor: Editor,
  shape: TLShape,
): shape is DiscourseNodeShape => {
  try {
    return editor.getShapeUtil(shape) instanceof DiscourseNodeUtil;
  } catch {
    return false;
  }
};

// Creation-facing list: provisional imported relation schemas are excluded so
// they cannot be used to create new relations on the canvas.
export const getAllRelations = () =>
  Object.values(discourseContext.relations)
    .flat()
    .filter((r) => !discourseContext.provisionalRelationIds.has(r.id));

export const checkConnectionType = (
  relation: { source: string; destination: string },
  sourceNodeType: string,
  targetNodeType: string,
): { isDirect: boolean; isReverse: boolean } => ({
  isDirect:
    sourceNodeType === relation.source &&
    targetNodeType === relation.destination,
  isReverse:
    sourceNodeType === relation.destination &&
    targetNodeType === relation.source,
});

export const hasValidRelationTypes = (
  sourceNodeType: string,
  targetNodeType: string,
): boolean =>
  getAllRelations().some(
    (r) =>
      (r.source === sourceNodeType && r.destination === targetNodeType) ||
      (r.source === targetNodeType && r.destination === sourceNodeType),
  );
