import getBlockProps, { json } from "~/utils/getBlockProps";
import setBlockProps from "~/utils/setBlockProps";
import {
  TLAnyBindingUtilConstructor,
  TLAnyShapeUtilConstructor,
  TLStore,
  TLStoreWithStatus,
  MigrationSequence,
  loadSnapshot,
} from "tldraw";
import { getRoamCanvasSnapshot } from "./useRoamStore";

export type CanvasSyncMode = "local" | "sync";
export type CanvasSyncMigrationState = "pending" | "done";

const QUERY_BUILDER_PROP_KEY = "roamjs-query-builder";
const CANVAS_SYNC_MODE_KEY = "canvasSyncMode";
const CANVAS_SYNC_MIGRATION_STATE_KEY = "canvasSyncMigrationState";
const DEFAULT_CANVAS_SYNC_MODE: CanvasSyncMode = "local";

const isCanvasSyncMode = (value: unknown): value is CanvasSyncMode =>
  value === "local" || value === "sync";

const isCanvasSyncMigrationState = (
  value: unknown,
): value is CanvasSyncMigrationState => value === "pending" || value === "done";

const getRoamJsQueryBuilderProps = (pageUid: string): Record<string, json> => {
  const props = getBlockProps(pageUid);
  const value = props[QUERY_BUILDER_PROP_KEY];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
};

const setRoamJsQueryBuilderProps = ({
  pageUid,
  nextRjsqb,
}: {
  pageUid: string;
  nextRjsqb: Record<string, json>;
}): void => {
  setBlockProps(pageUid, {
    [QUERY_BUILDER_PROP_KEY]: nextRjsqb,
  });
};

const updateCanvasSyncProps = ({
  pageUid,
  updates,
}: {
  pageUid: string;
  updates: Partial<
    Record<
      typeof CANVAS_SYNC_MODE_KEY | typeof CANVAS_SYNC_MIGRATION_STATE_KEY,
      json
    >
  >;
}): void => {
  const rjsqb = getRoamJsQueryBuilderProps(pageUid);
  setRoamJsQueryBuilderProps({
    pageUid,
    nextRjsqb: {
      ...rjsqb,
      ...updates,
    },
  });
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
  updateCanvasSyncProps({
    pageUid,
    updates: {
      [CANVAS_SYNC_MODE_KEY]: mode,
    },
  });
};

export const getCanvasSyncMigrationState = ({
  pageUid,
}: {
  pageUid: string;
}): CanvasSyncMigrationState | null => {
  const rjsqb = getRoamJsQueryBuilderProps(pageUid);
  const migrationState = rjsqb[CANVAS_SYNC_MIGRATION_STATE_KEY];
  return isCanvasSyncMigrationState(migrationState) ? migrationState : null;
};

export const setCanvasSyncMigrationState = ({
  pageUid,
  state,
}: {
  pageUid: string;
  state: CanvasSyncMigrationState;
}): void => {
  updateCanvasSyncProps({
    pageUid,
    updates: {
      [CANVAS_SYNC_MIGRATION_STATE_KEY]: state,
    },
  });
};

export const setCanvasSyncSettings = ({
  pageUid,
  mode,
  migrationState,
}: {
  pageUid: string;
  mode: CanvasSyncMode;
  migrationState?: CanvasSyncMigrationState;
}): void => {
  updateCanvasSyncProps({
    pageUid,
    updates: {
      [CANVAS_SYNC_MODE_KEY]: mode,
      ...(migrationState
        ? { [CANVAS_SYNC_MIGRATION_STATE_KEY]: migrationState }
        : {}),
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

export const getReadyCanvasStore = (
  store: TLStore | TLStoreWithStatus | null,
): TLStore | null => {
  if (!store) return null;
  if ("status" in store) {
    return store.status === "synced-remote" ? store.store : null;
  }
  return store;
};

const getShapeRecordCount = (store: TLStore): number => {
  return Object.values(store.serialize()).filter(
    (record) => record.typeName === "shape",
  ).length;
};

export const migrateLocalCanvasToCloud = ({
  pageUid,
  store,
  migrations,
  customShapeUtils,
  customBindingUtils,
}: {
  pageUid: string;
  store: TLStore;
  migrations: MigrationSequence[];
  customShapeUtils: readonly TLAnyShapeUtilConstructor[];
  customBindingUtils: readonly TLAnyBindingUtilConstructor[];
}): { migrated: boolean; migrationState: CanvasSyncMigrationState } => {
  if (getShapeRecordCount(store) > 0) {
    setCanvasSyncSettings({
      pageUid,
      mode: "sync",
      migrationState: "done",
    });
    return {
      migrated: false,
      migrationState: "done",
    };
  }

  const localSnapshot = getRoamCanvasSnapshot({
    pageUid,
    migrations,
    customShapeUtils,
    customBindingUtils,
    includePersonalRecords: false,
  });

  if (!localSnapshot) {
    setCanvasSyncSettings({
      pageUid,
      mode: "sync",
      migrationState: "done",
    });
    return {
      migrated: false,
      migrationState: "done",
    };
  }

  loadSnapshot(store, localSnapshot);

  setCanvasSyncSettings({
    pageUid,
    mode: "sync",
    migrationState: "done",
  });

  return {
    migrated: true,
    migrationState: "done",
  };
};
