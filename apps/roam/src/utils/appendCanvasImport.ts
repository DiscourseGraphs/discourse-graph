import type {
  SerializedStore,
  TLParentId,
  TLRecord,
  TLStoreSnapshot,
} from "@tldraw/editor";
import nanoid from "nanoid";
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
  shapes: SerializedStore<TLRecord>;
  newCanvas?: TLStoreSnapshot;
}): Promise<boolean> => {
  // Measuring import results can await image loads. Append to the current target.
  const { props, queryBuilder } = readCompatibleLocalCanvas(pageUid);
  const saved = queryBuilder.tldraw;
  const snapshot = isTLStoreSnapshot(saved) ? saved : newCanvas;
  if (!snapshot || snapshot.store[parentId]?.typeName !== "page") return false;
  if (saved && !isTLStoreSnapshot(saved) && Object.keys(saved).length)
    return false;

  await window.roamAlphaAPI.updateBlock({
    block: {
      uid: pageUid,
      props: {
        ...props,
        "roamjs-query-builder": {
          ...queryBuilder,
          stateId: nanoid(),
          tldraw: { ...snapshot, store: { ...snapshot.store, ...shapes } },
        },
      },
    },
  });
  return true;
};
