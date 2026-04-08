import { Editor, TLShape } from "tldraw";
import {
  BaseDiscourseNodeUtil,
  DiscourseNodeShape,
} from "~/components/canvas/DiscourseNodeUtil";
import { discourseContext } from "~/components/canvas/Tldraw";

export const isDiscourseNodeShape = (
  editor: Editor,
  shape: TLShape,
): shape is DiscourseNodeShape => {
  try {
    return editor.getShapeUtil(shape) instanceof BaseDiscourseNodeUtil;
  } catch {
    return false;
  }
};

export const getAllRelations = () =>
  Object.values(discourseContext.relations).flat();

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
