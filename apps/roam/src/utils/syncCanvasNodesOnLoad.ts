import type { Editor } from "tldraw";
import type { OnloadArgs } from "roamjs-components/types";
import type { DiscourseNodeShape } from "~/components/canvas/DiscourseNodeUtil";
import { DEFAULT_STYLE_PROPS } from "~/components/canvas/DiscourseNodeUtil";
import { MAX_WIDTH } from "~/components/canvas/Tldraw";
import type { TreeNode } from "roamjs-components/types";
import calcCanvasNodeSizeAndImg, {
  findFirstImage,
  getFirstImageByUid,
} from "./calcCanvasNodeSizeAndImg";
import getDiscourseNodes from "./getDiscourseNodes";
import resolveQueryBuilderRef from "./resolveQueryBuilderRef";
import runQuery from "./runQuery";
import { measureCanvasNodeText } from "./measureCanvasNodeText";

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
 * On canvas load: sync discourse node shape titles and key images with Roam,
 * and remove shapes whose nodes no longer exist.
 * - Queries Roam for current title per uid via async.fast.q
 * - Updates shapes whose title changed
 * - Removes shapes whose uid no longer exists in the graph
 * - Updates key images for surviving shapes, recomputing dimensions only when
 *   a shape gains or loses an image
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
  const { discourseNodeShapes, uidToTitle } = await syncCanvasNodeTitlesOnLoad({
    editor,
    nodeTypeIds,
    relationShapeTypeIds,
  });
  await syncCanvasKeyImagesOnLoad({
    editor,
    discourseNodeShapes,
    uidToTitle,
    extensionAPI,
  });
};
export const syncCanvasNodeTitlesOnLoad = async ({
  editor,
  nodeTypeIds,
  relationShapeTypeIds,
}: {
  editor: Editor;
  nodeTypeIds: string[];
  relationShapeTypeIds: string[];
}): Promise<{
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

type BlockNode = {
  uid: string;
  text: string;
  order: number;
  parentUid: string;
  children: BlockNode[];
};

/**
 * Batch-fetch the first markdown image URL for multiple UIDs.
 *
 * The naive alternative — calling getFirstImageByUid() per shape — uses
 * window.roamAlphaAPI.pull, which is synchronous and blocks the main thread.
 * For a canvas with many shapes this causes a noticeable UI freeze on load.
 *
 * Instead, we use a single async Datalog query (data.async.fast.q) that fetches
 * all block strings for all page UIDs off the main thread, reconstruct the tree
 * in JS, then DFS with findFirstImage (handling embeds and block refs).
 *
 * Trade-off: unlike getFirstImageByUid, this fetches all blocks on the page with
 * no early termination. For very large pages this may transfer more data, but the
 * async execution avoids blocking the UI entirely.
 *
 * Block UIDs (discourse nodes that are blocks, not pages) are partitioned out
 * and handled with getFirstImageByUid individually since the page-scoped Datalog
 * query does not apply to them.
 */
const batchGetFirstImageUrlsByUids = async (
  uids: string[],
): Promise<Map<string, string>> => {
  if (uids.length === 0) return new Map();

  // Identify which UIDs are page UIDs — the batch tree query only works for pages.
  const pageUidRows = (await window.roamAlphaAPI.data.async.fast.q(
    `[:find ?uid
      :in $ [?uid ...]
      :where [?e :block/uid ?uid]
             [?e :node/title]]`,
    uids,
  )) as [string][];

  const pageUidSet = new Set(pageUidRows.map(([uid]) => uid));
  const pageUids = [...pageUidSet];
  const blockUids = uids.filter((uid) => !pageUidSet.has(uid));

  const uidToImageUrl = new Map<string, string>();

  // Batch tree query for page UIDs.
  if (pageUids.length > 0) {
    // Each row: [pageUid, blockUid, string, order, parentUid]
    // parentUid === pageUid for top-level blocks, a block uid for nested ones.
    const results = (await window.roamAlphaAPI.data.async.fast.q(
      `[:find ?pageUid ?blockUid ?string ?order ?parentUid
        :in $ [?pageUid ...]
        :where [?page :block/uid ?pageUid]
               [?block :block/page ?page]
               [?block :block/uid ?blockUid]
               [?block :block/string ?string]
               [?block :block/order ?order]
               [?parent :block/children ?block]
               [?parent :block/uid ?parentUid]]`,
      pageUids,
    )) as [string, string, string, number, string][];

    const pageToBlockMap = new Map<string, Map<string, BlockNode>>();
    for (const [pageUid, blockUid, text, order, parentUid] of results) {
      if (!pageToBlockMap.has(pageUid)) pageToBlockMap.set(pageUid, new Map());
      pageToBlockMap.get(pageUid)!.set(blockUid, {
        uid: blockUid,
        text,
        order,
        parentUid,
        children: [],
      });
    }

    for (const pageUid of pageUids) {
      const blockMap = pageToBlockMap.get(pageUid);
      if (!blockMap) {
        uidToImageUrl.set(pageUid, "");
        continue;
      }
      const rootBlocks: BlockNode[] = [];
      for (const block of blockMap.values()) {
        if (block.parentUid === pageUid) {
          rootBlocks.push(block);
        } else {
          blockMap.get(block.parentUid)?.children.push(block);
        }
      }
      for (const block of blockMap.values()) {
        block.children.sort((a, b) => a.order - b.order);
      }
      rootBlocks.sort((a, b) => a.order - b.order);
      // Use a synthetic root so findFirstImage can traverse all top-level blocks.
      const syntheticRoot = {
        uid: pageUid,
        text: "",
        children: rootBlocks as unknown as TreeNode[],
      } as TreeNode;
      uidToImageUrl.set(pageUid, findFirstImage(syntheticRoot) ?? "");
    }
  }

  // Block UIDs: getFirstImageByUid handles both pages and blocks correctly.
  for (const uid of blockUids) {
    uidToImageUrl.set(uid, getFirstImageByUid(uid) ?? "");
  }

  return uidToImageUrl;
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
  if (survivingShapes.length === 0) return;

  // Compute canvas settings once to avoid calling getDiscourseNodes() per shape.
  const allNodes = getDiscourseNodes();
  const nodeTypeToCanvasSettings = Object.fromEntries(
    allNodes.map((n) => [n.type, n.canvasSettings as Record<string, string>]),
  );

  // Separate shapes by key-image fetch strategy.
  const firstImageShapes: DiscourseNodeShape[] = [];
  const queryBuilderShapes: DiscourseNodeShape[] = [];
  for (const shape of survivingShapes) {
    const settings = nodeTypeToCanvasSettings[shape.type] ?? {};
    if (!settings["key-image"]) continue;
    if (settings["key-image-option"] === "query-builder") {
      queryBuilderShapes.push(shape);
    } else {
      firstImageShapes.push(shape);
    }
  }

  // Batch query for "First image on page" shapes — one Roam query for all.
  const uidToFirstImage = await batchGetFirstImageUrlsByUids(
    firstImageShapes.map((s) => s.props.uid),
  );

  // Per-shape queries for "Query builder" shapes (inherently per-node).
  const qbResults = await Promise.all(
    queryBuilderShapes.map(async (shape) => {
      const title = uidToTitle.get(shape.props.uid) ?? shape.props.title ?? "";
      const settings = nodeTypeToCanvasSettings[shape.type] ?? {};
      const qbAlias = settings["query-builder-alias"] ?? "";
      const parentUid = resolveQueryBuilderRef({
        queryRef: qbAlias,
        extensionAPI,
      });
      const results = await runQuery({
        extensionAPI,
        parentUid,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        inputs: { NODETEXT: title, NODEUID: shape.props.uid },
      });
      const resultUid = results.allProcessedResults[0]?.uid ?? "";
      const imageUrl = getFirstImageByUid(resultUid) ?? "";
      return { shape, imageUrl };
    }),
  );

  const urlResults: { shape: DiscourseNodeShape; imageUrl: string }[] = [
    // Shapes with no key-image configured always get an empty imageUrl.
    ...survivingShapes
      .filter((s) => !nodeTypeToCanvasSettings[s.type]?.["key-image"])
      .map((shape) => ({ shape, imageUrl: "" })),
    ...firstImageShapes.map((shape) => ({
      shape,
      imageUrl: uidToFirstImage.get(shape.props.uid) ?? "",
    })),
    ...qbResults,
  ];

  const changedShapes = urlResults.filter(
    ({ shape, imageUrl }) => (shape.props.imageUrl ?? "") !== imageUrl,
  );

  // Only load images when imageUrl transitions between empty and non-empty,
  // since those are the only cases that require recomputing dimensions.
  const imageUpdates: {
    id: DiscourseNodeShape["id"];
    type: string;
    props: { imageUrl: string; w?: number; h?: number };
  }[] = [];

  await Promise.all(
    changedShapes.map(async ({ shape, imageUrl }) => {
      const prevImageUrl = shape.props.imageUrl ?? "";
      const title = uidToTitle.get(shape.props.uid) ?? shape.props.title ?? "";

      if (prevImageUrl === "" && imageUrl !== "") {
        // Image newly added: compute dimensions including image height.
        // Pass the pre-fetched imageUrl to skip re-fetching it.
        const {
          w,
          h,
          imageUrl: resolvedImageUrl,
        } = await calcCanvasNodeSizeAndImg({
          nodeText: title,
          uid: shape.props.uid,
          nodeType: shape.type,
          extensionAPI,
          imageUrl,
        });
        imageUpdates.push({
          id: shape.id,
          type: shape.type,
          props: { imageUrl: resolvedImageUrl, w, h },
        });
      } else if (prevImageUrl !== "" && imageUrl === "") {
        // Image removed: recompute as text-only dimensions.
        const { w, h } = measureCanvasNodeText({
          ...DEFAULT_STYLE_PROPS,
          maxWidth: MAX_WIDTH,
          text: title,
        });
        imageUpdates.push({
          id: shape.id,
          type: shape.type,
          props: { imageUrl: "", w, h },
        });
      } else {
        // URL changed but both are non-empty: update imageUrl only, leave w/h.
        imageUpdates.push({
          id: shape.id,
          type: shape.type,
          props: { imageUrl },
        });
      }
    }),
  );

  if (imageUpdates.length > 0) {
    editor.updateShapes(imageUpdates);
  }
};
