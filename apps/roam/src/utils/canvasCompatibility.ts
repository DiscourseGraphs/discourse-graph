import getBlockProps, { isJsonObject, type json } from "./getBlockProps";
import type { TLStoreSnapshot } from "tldraw";

export const isTLStoreSnapshot = (value: unknown): value is TLStoreSnapshot =>
  typeof value === "object" &&
  value !== null &&
  "store" in value &&
  "schema" in value;

// Raise this only in a release that understands every canvas format up to this version.
export const SUPPORTED_CANVAS_COMPATIBILITY_VERSION = 0;

const UPDATE_MESSAGE =
  "This canvas was updated by a newer version of Discourse Graphs. Update the extension to open it.";
const INVALID_MESSAGE =
  "This canvas has an invalid compatibility version. Contact Discourse Graphs support before editing it.";

export const getCanvasCompatibilityVersion = (
  snapshot: json | undefined,
): json | undefined => {
  if (!isJsonObject(snapshot)) return undefined;
  // Legacy canvases store the record map directly. Newer snapshots wrap it in `store`.
  const records = "store" in snapshot ? snapshot.store : snapshot;
  if (!isJsonObject(records) || !("document:document" in records))
    return undefined;
  const document = records["document:document"];
  if (!isJsonObject(document)) return null;
  if (!("meta" in document)) return undefined;
  return isJsonObject(document.meta)
    ? document.meta.canvasCompatibilityVersion
    : null;
};

export const getCanvasCompatibilityMessage = (
  snapshot: json | undefined,
): string | null => {
  const version = getCanvasCompatibilityVersion(snapshot);
  if (version === undefined) return null;
  if (
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0
  )
    return INVALID_MESSAGE;
  return version > SUPPORTED_CANVAS_COMPATIBILITY_VERSION
    ? UPDATE_MESSAGE
    : null;
};

export const getCanvasQueryBuilderProps = (
  props: Record<string, json>,
): Record<string, json> => {
  const queryBuilder = props["roamjs-query-builder"];
  return isJsonObject(queryBuilder) ? queryBuilder : {};
};

export const readLocalCanvas = (
  pageUid: string,
): {
  props: Record<string, json>;
  queryBuilder: Record<string, json>;
} => {
  const props = getBlockProps(pageUid);
  return { props, queryBuilder: getCanvasQueryBuilderProps(props) };
};

export class CanvasCompatibilityError extends Error {}

export const readCompatibleLocalCanvas = (
  pageUid: string,
): ReturnType<typeof readLocalCanvas> => {
  const canvas = readLocalCanvas(pageUid);
  const message = getCanvasCompatibilityMessage(canvas.queryBuilder.tldraw);
  if (message) throw new CanvasCompatibilityError(message);
  return canvas;
};
