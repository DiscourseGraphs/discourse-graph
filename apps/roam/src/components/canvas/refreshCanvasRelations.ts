import { discourseContext } from "~/components/canvas/Tldraw";
import getDiscourseRelations, {
  type DiscourseRelation,
} from "~/utils/getDiscourseRelations";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { notifyRelationSchemaChange } from "~/utils/relationSchemaChanges";

export const groupRelationsByLabel = (
  relations: DiscourseRelation[],
): Record<string, DiscourseRelation[]> =>
  relations.reduce(
    (acc, r) => {
      if (acc[r.label]) {
        acc[r.label].push(r);
      } else {
        acc[r.label] = [r];
      }
      return acc;
    },
    {} as Record<string, DiscourseRelation[]>,
  );

// Mounted canvases read discourseContext.relations, so a new triplet is invisible until this runs.
export const refreshCanvasRelations = (): void => {
  refreshConfigTree();
  discourseContext.relations = groupRelationsByLabel(getDiscourseRelations());
  notifyRelationSchemaChange();
};
