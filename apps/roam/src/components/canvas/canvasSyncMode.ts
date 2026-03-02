import getBlockProps, { json } from "~/utils/getBlockProps";
import setBlockProps from "~/utils/setBlockProps";

export type CanvasSyncMode = "local" | "sync";

const QUERY_BUILDER_PROP_KEY = "roamjs-query-builder";
const CANVAS_SYNC_MODE_KEY = "canvasSyncMode";
const DEFAULT_CANVAS_SYNC_MODE: CanvasSyncMode = "local";

const isCanvasSyncMode = (value: unknown): value is CanvasSyncMode =>
  value === "local" || value === "sync";

const getRoamJsQueryBuilderProps = (pageUid: string): Record<string, json> => {
  const props = getBlockProps(pageUid);
  const value = props[QUERY_BUILDER_PROP_KEY];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
};

export const getPersistedCanvasSyncMode = ({
  pageUid,
}: {
  pageUid: string;
}): CanvasSyncMode | null => {
  const rjsqb = getRoamJsQueryBuilderProps(pageUid);
  const mode = rjsqb[CANVAS_SYNC_MODE_KEY];
  return isCanvasSyncMode(mode) ? mode : null;
};

export const getEffectiveCanvasSyncMode = ({
  pageUid,
}: {
  pageUid: string;
}): CanvasSyncMode => {
  return getPersistedCanvasSyncMode({ pageUid }) ?? DEFAULT_CANVAS_SYNC_MODE;
};

export const setCanvasSyncMode = ({
  pageUid,
  mode,
}: {
  pageUid: string;
  mode: CanvasSyncMode;
}): void => {
  const rjsqb = getRoamJsQueryBuilderProps(pageUid);
  setBlockProps(pageUid, {
    [QUERY_BUILDER_PROP_KEY]: {
      ...rjsqb,
      [CANVAS_SYNC_MODE_KEY]: mode,
    },
  });
};

export const ensureCanvasSyncMode = ({
  pageUid,
}: {
  pageUid: string;
}): CanvasSyncMode => {
  const mode = getPersistedCanvasSyncMode({ pageUid });
  if (mode) return mode;
  setCanvasSyncMode({ pageUid, mode: DEFAULT_CANVAS_SYNC_MODE });
  return DEFAULT_CANVAS_SYNC_MODE;
};
