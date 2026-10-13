import { Editor, TLShape } from "tldraw";
import {
  DiscourseNodeUtil,
  DiscourseNodeShape,
} from "~/components/canvas/DiscourseNodeUtil";
import { discourseContext } from "~/components/canvas/Tldraw";
import { isAcceptedRelationSchema } from "~/utils/relationSchemaAcceptance";

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

export const getAllRelations = () =>
  Object.values(discourseContext.relations).flat();

export const getCreatableRelations = () =>
  getAllRelations().filter(isAcceptedRelationSchema);

export const hasAcceptedRelationSchema = (relationLabel: string): boolean =>
  !!discourseContext.relations[relationLabel]?.some(isAcceptedRelationSchema);

export { checkConnectionType } from "~/utils/findRelationForPair";

export const hasValidRelationTypes = (
  sourceNodeType: string,
  targetNodeType: string,
): boolean =>
  getCreatableRelations().some(
    (r) =>
      (r.source === sourceNodeType && r.destination === targetNodeType) ||
      (r.source === targetNodeType && r.destination === sourceNodeType),
  );
