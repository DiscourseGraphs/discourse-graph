import type { TLParentId, TLStoreSnapshot } from "@tldraw/editor";
import { getIndexAbove, type IndexKey } from "@tldraw/utils";
import nanoid from "nanoid";
import type { DiscourseNodeShape } from "~/components/canvas/DiscourseNodeUtil";
import {
  isTLStoreSnapshot,
  readCompatibleLocalCanvas,
} from "./canvasCompatibility";

export const appendCanvasImport = async ({
  pageUid,
  parentId,
  shapes,
  newCanvas,
}: {
  pageUid: string;
  parentId: TLParentId;
  shapes: Omit<DiscourseNodeShape, "index">[];
  newCanvas?: TLStoreSnapshot;
}): Promise<boolean> => {
  // Measuring import results can await image loads. Append to the current target.
  const { props, queryBuilder } = readCompatibleLocalCanvas(pageUid);
  const saved = queryBuilder.tldraw;
  const snapshot = isTLStoreSnapshot(saved) ? saved : newCanvas;
  if (!snapshot || snapshot.store[parentId]?.typeName !== "page") return false;
  if (saved && !isTLStoreSnapshot(saved) && Object.keys(saved).length)
    return false;

  // A sibling may have taken the next index while the import was measuring shapes.
  let index = "a1" as IndexKey;
  for (const record of Object.values(snapshot.store)) {
    if (
      record.typeName === "shape" &&
      record.parentId === parentId &&
      record.index > index
    )
      index = record.index;
  }
  const records = { ...snapshot.store };
  for (const shape of shapes) {
    index = getIndexAbove(index);
    records[shape.id] = { ...shape, index };
  }

  await window.roamAlphaAPI.updateBlock({
    block: {
      uid: pageUid,
      props: {
        ...props,
        "roamjs-query-builder": {
          ...queryBuilder,
          stateId: nanoid(),
          tldraw: { ...snapshot, store: records },
        },
      },
    },
  });
  return true;
};
