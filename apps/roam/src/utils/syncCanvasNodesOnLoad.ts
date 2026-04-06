import type { Editor } from "tldraw";
import type { OnloadArgs } from "roamjs-components/types";
import type { DiscourseNodeShape } from "~/components/canvas/DiscourseNodeUtil";
import calcCanvasNodeSizeAndImg, {
  getCanvasNodeKeyImageUrl,
} from "./calcCanvasNodeSizeAndImg";

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
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
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
  editor
    .deleteShapes(relationShapeIdsToDelete)
    .deleteBindings(bindingIdsToDelete);
  editor.deleteShapes([shape.id]);
};

/**
 * On canvas load: sync discourse node shape titles with Roam and remove shapes whose nodes no longer exist.
 * - Queries Roam for current title per uid via async.fast.q
 * - Updates shapes whose title changed
 * - Removes shapes whose uid no longer exists in the graph
 */
export const syncCanvasNodesOnLoad = async ({
  editor,
  nodeTypeIds,
  relationShapeTypeIds,
  extensionAPI,
}: {
  editor: Editor;
  nodeTypeIds: string[];
  relationShapeTypeIds: string[];
  extensionAPI: OnloadArgs["extensionAPI"];
}): Promise<void> => {
  const { discourseNodeShapes, uidToTitle } = await syncCanvasNodeTitlesOnLoad(
    editor,
    nodeTypeIds,
    relationShapeTypeIds,
  );
  await syncCanvasKeyImagesOnLoad({
    editor,
    discourseNodeShapes,
    uidToTitle,
    extensionAPI,
  });
};
export const syncCanvasNodeTitlesOnLoad = async (
  editor: Editor,
  nodeTypeIds: string[],
  relationShapeTypeIds: string[],
): Promise<{
  discourseNodeShapes: DiscourseNodeShape[];
  uidToTitle: Map<string, string>;
}> => {
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
  if (uids.length === 0)
    return { discourseNodeShapes: [], uidToTitle: new Map() };

  const uidToTitle = await queryTitlesByUids(uids);

  const shapesToUpdate: { shape: DiscourseNodeShape; newTitle: string }[] = [];
  const shapesToRemove: DiscourseNodeShape[] = [];

  for (const shape of discourseNodeShapes) {
    const uid = shape.props.uid;
    const currentInRoam = uidToTitle.get(uid);
    if (currentInRoam === undefined) {
      shapesToRemove.push(shape);
    } else if ((shape.props.title ?? "") !== (currentInRoam ?? "")) {
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
        props: { title: newTitle },
      })),
    );
  }

  return { discourseNodeShapes, uidToTitle };
};

const syncCanvasKeyImagesOnLoad = async ({
  editor,
  discourseNodeShapes,
  uidToTitle,
  extensionAPI,
}: {
  editor: Editor;
  discourseNodeShapes: DiscourseNodeShape[];
  uidToTitle: Map<string, string>;
  extensionAPI: OnloadArgs["extensionAPI"];
}): Promise<void> => {
  const survivingShapes = discourseNodeShapes.filter((s) =>
    uidToTitle.has(s.props.uid),
  );
  const imageUpdates: {
    id: DiscourseNodeShape["id"];
    type: string;
    props: { imageUrl: string; w: number; h: number };
  }[] = [];

  // First pass: cheaply fetch imageUrls (no image loading) to find which shapes changed.
  const urlResults = await Promise.all(
    survivingShapes.map(async (shape) => {
      const title = uidToTitle.get(shape.props.uid) ?? shape.props.title ?? "";
      const imageUrl = await getCanvasNodeKeyImageUrl({
        nodeText: title,
        uid: shape.props.uid,
        nodeType: shape.type,
        extensionAPI,
      });
      return { shape, title, imageUrl };
    }),
  );

  const changedShapes = urlResults.filter(
    ({ shape, imageUrl }) => (shape.props.imageUrl ?? "") !== imageUrl,
  );

  // Second pass: load images only for shapes whose URL changed, to compute new dimensions.
  await Promise.all(
    changedShapes.map(async ({ shape, title }) => {
      const { w, h, imageUrl } = await calcCanvasNodeSizeAndImg({
        nodeText: title,
        uid: shape.props.uid,
        nodeType: shape.type,
        extensionAPI,
      });
      imageUpdates.push({
        id: shape.id,
        type: shape.type,
        props: { imageUrl, w, h },
      });
    }),
  );

  if (imageUpdates.length > 0) {
    editor.updateShapes(imageUpdates);
  }
};
