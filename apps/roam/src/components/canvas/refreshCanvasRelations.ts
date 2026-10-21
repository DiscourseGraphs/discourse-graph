import { discourseContext } from "~/components/canvas/Tldraw";
import getDiscourseRelations, {
  type DiscourseRelation,
} from "~/utils/getDiscourseRelations";
import refreshConfigTree from "~/utils/refreshConfigTree";
import {
  markRelationSchemaDeleted,
  notifyRelationSchemaChange,
} from "~/utils/relationSchemaChanges";

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
// Relations gone from settings are kept so existing arrows still render, but marked deleted
// so creation paths skip them; not every deletion path marks its schema.
export const refreshCanvasRelations = (): void => {
  refreshConfigTree();
  const fresh = getDiscourseRelations();
  const freshIds = new Set(fresh.map((r) => r.id));
  const removed = Object.values(discourseContext.relations)
    .flat()
    .filter((r) => !freshIds.has(r.id));
  discourseContext.relations = groupRelationsByLabel([...fresh, ...removed]);
  new Set(removed.map((r) => r.id)).forEach(markRelationSchemaDeleted);
  notifyRelationSchemaChange();
};
