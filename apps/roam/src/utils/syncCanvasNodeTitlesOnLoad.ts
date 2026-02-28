import type { Editor } from "tldraw";
import type { DiscourseNodeShape } from "~/components/canvas/DiscourseNodeUtil";

/**
 * Query Roam for current :node/title or :block/string for each uid.
 * Returns a map of uid -> title for uids that exist; uids not in the map no longer exist.
 */
const queryTitlesByUids = async (
  uids: string[],
): Promise<Map<string, string>> => {
  if (uids.length === 0) return new Map();

  const results = (await window.roamAlphaAPI.data.async.fast.q(
    `[:find ?uid (pull ?e [:node/title :block/string])
      :in $ [?uid ...]
      :where [?e :block/uid ?uid]]`,
    uids,
  )) as [string, { ":node/title"?: string; ":block/string"?: string }][];

  const map = new Map<string, string>();
  for (const [uid, pull] of results) {
    const title = pull?.[":node/title"] ?? pull?.[":block/string"] ?? "";
    map.set(uid, title);
  }
  return map;
};

/** Delete relation arrows and their bindings that reference this node shape, then the node shape. */
const deleteNodeShapeAndRelations = (
  editor: Editor,
  shape: DiscourseNodeShape,
  relationIds: Set<string>,
): void => {
  const bindingsToThisShape = Array.from(relationIds).flatMap((typeId) =>
    editor.getBindingsToShape(shape.id, typeId),
  );
  const relationShapeIdsAndType = bindingsToThisShape.map((b) => ({
    id: b.fromId,
    type: b.type,
  }));
  const bindingsToDelete = relationShapeIdsAndType.flatMap(({ id, type }) =>
    editor.getBindingsFromShape(id, type),
  );
  const relationShapeIdsToDelete = relationShapeIdsAndType.map((r) => r.id);
  const bindingIdsToDelete = bindingsToDelete.map((b) => b.id);
  editor.deleteShapes(relationShapeIdsToDelete).deleteBindings(bindingIdsToDelete);
  editor.deleteShapes([shape.id]);
};

/**
 * On canvas load: sync discourse node shape titles with Roam and remove shapes whose nodes no longer exist.
 * - Queries Roam for current title per uid via async.fast.q
 * - Updates shapes whose title changed
 * - Removes shapes whose uid no longer exists in the graph
 */
export const syncCanvasNodeTitlesOnLoad = async (
  editor: Editor,
  nodeTypeIds: string[],
  relationShapeTypeIds: string[],
): Promise<void> => {
  const nodeTypeSet = new Set(nodeTypeIds);
  const relationIds = new Set(relationShapeTypeIds);
  const allRecords = editor.store.allRecords();
  const discourseNodeShapes = allRecords.filter(
    (r) =>
      r.typeName === "shape" &&
      nodeTypeSet.has((r as DiscourseNodeShape).type) &&
      typeof (r as DiscourseNodeShape).props?.uid === "string",
  ) as DiscourseNodeShape[];

  const uids = [...new Set(discourseNodeShapes.map((s) => s.props.uid))];
  if (uids.length === 0) return;

  const uidToTitle = await queryTitlesByUids(uids);

  const shapesToUpdate: { shape: DiscourseNodeShape; newTitle: string }[] = [];
  const shapesToRemove: DiscourseNodeShape[] = [];

  for (const shape of discourseNodeShapes) {
    const uid = shape.props.uid;
    const currentInRoam = uidToTitle.get(uid);
    if (currentInRoam === undefined) {
      shapesToRemove.push(shape);
    } else if ((shape.props.title ?? "").trim() !== (currentInRoam ?? "").trim()) {
      shapesToUpdate.push({ shape, newTitle: currentInRoam });
    }
  }

  if (shapesToRemove.length > 0) {
    for (const shape of shapesToRemove) {
      deleteNodeShapeAndRelations(editor, shape, relationIds);
    }
  }

  if (shapesToUpdate.length > 0) {
    editor.updateShapes(
      shapesToUpdate.map(({ shape, newTitle }) => ({
        id: shape.id,
        type: shape.type,
        props: { ...shape.props, title: newTitle },
      })),
    );
  }
};
