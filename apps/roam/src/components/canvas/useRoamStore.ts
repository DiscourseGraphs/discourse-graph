import { TLRecord } from "@tldraw/tlschema";
import nanoid from "nanoid";
import { useRef, useMemo, useEffect, useState } from "react";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSubTree from "roamjs-components/util/getSubTree";
import setInputSetting from "roamjs-components/util/setInputSetting";
import createBlock from "roamjs-components/writes/createBlock";
import getBlockProps, { json, normalizeProps } from "~/utils/getBlockProps";
import {
  createTLStore,
  TLAnyBindingUtilConstructor,
  TLAnyShapeUtilConstructor,
} from "@tldraw/editor";
import { SerializedStore } from "@tldraw/store";
import {
  defaultBindingUtils,
  defaultShapeUtils,
  loadSnapshot,
  MigrationSequence,
  TLFrameShape,
  TLShape,
  TLStoreSnapshot,
  TLStore,
} from "tldraw";
import { AddPullWatch } from "roamjs-components/types";
import { LEGACY_SCHEMA } from "~/data/legacyTldrawSchema";
import internalError from "~/utils/internalError";
import {
  isTLStoreSnapshot,
  filterUserRecords,
  fixShapeIndices,
  mergeRemoteCanvasState,
} from "./canvasRemoteMerge";

const THROTTLE = 350;

export { isTLStoreSnapshot } from "./canvasRemoteMerge";

const createCanvasStore = ({
  migrations,
  customShapeUtils,
  customBindingUtils,
}: {
  migrations: MigrationSequence[];
  customShapeUtils: readonly TLAnyShapeUtilConstructor[];
  customBindingUtils: readonly TLAnyBindingUtilConstructor[];
}): TLStore =>
  createTLStore({
    migrations,
    shapeUtils: [...defaultShapeUtils, ...customShapeUtils],
    bindingUtils: [...defaultBindingUtils, ...customBindingUtils],
  });

const getPersistedRoamCanvasState = ({
  pageUid,
}: {
  pageUid: string;
}): {
  initialSnapshot: TLStoreSnapshot | null;
  oldData: SerializedStore<TLRecord> | null;
} => {
  const props = getBlockProps(pageUid) as Record<string, unknown>;
  const rjsqb =
    typeof props["roamjs-query-builder"] === "object"
      ? (props["roamjs-query-builder"] as Record<string, unknown>)
      : {};

  if (isTLStoreSnapshot(rjsqb.tldraw))
    return {
      initialSnapshot: rjsqb.tldraw,
      oldData: null,
    };

  return {
    initialSnapshot: null,
    oldData: rjsqb?.tldraw ? (rjsqb.tldraw as SerializedStore<TLRecord>) : null,
  };
};

const upgradeLegacyStoreSnapshot = ({
  oldData,
  migrations,
  customShapeUtils,
  customBindingUtils,
}: {
  oldData: SerializedStore<TLRecord>;
  migrations: MigrationSequence[];
  customShapeUtils: readonly TLAnyShapeUtilConstructor[];
  customBindingUtils: readonly TLAnyBindingUtilConstructor[];
}): TLStoreSnapshot => {
  const newStore = createCanvasStore({
    migrations,
    customShapeUtils,
    customBindingUtils,
  });
  const filteredData = filterUserRecords(oldData);
  const dataWithFixedShapes = fixShapeIndices(filteredData);

  loadSnapshot(newStore, {
    store: dataWithFixedShapes,
    schema: LEGACY_SCHEMA,
  });

  return newStore.getStoreSnapshot();
};

export const getRoamCanvasSnapshot = ({
  pageUid,
  migrations,
  customShapeUtils,
  customBindingUtils,
  includePersonalRecords = true,
}: {
  pageUid: string;
  migrations: MigrationSequence[];
  customShapeUtils: readonly TLAnyShapeUtilConstructor[];
  customBindingUtils: readonly TLAnyBindingUtilConstructor[];
  includePersonalRecords?: boolean;
}): TLStoreSnapshot | null => {
  const { initialSnapshot, oldData } = getPersistedRoamCanvasState({ pageUid });

  const snapshot = initialSnapshot
    ? initialSnapshot
    : oldData
      ? upgradeLegacyStoreSnapshot({
          oldData,
          migrations,
          customShapeUtils,
          customBindingUtils,
        })
      : null;

  if (!snapshot || includePersonalRecords) return snapshot;

  return {
    ...snapshot,
    store: filterUserRecords(snapshot.store),
  };
};

// The raw persisted record map from block props, without constructing or
// migrating a TLStore (modern `{ store, schema }` store, or the legacy raw
// store, whichever is present). Cheap read for callers that only need to
// inspect records — no throwaway editor, and no ValidationError on an
// un-migrated legacy node shape the way loadSnapshot-without-utils would throw.
export const getPersistedCanvasStore = (
  pageUid: string,
): SerializedStore<TLRecord> => {
  const { initialSnapshot, oldData } = getPersistedRoamCanvasState({ pageUid });
  return initialSnapshot ? initialSnapshot.store : (oldData ?? {});
};

// Frame shapes on a canvas. Frames are default tldraw shapes — present verbatim
// in both persisted formats and untouched by discourse-node migrations — so
// this raw scan needs no migration or shape utils.
export const getCanvasFrameShapes = (pageUid: string): TLFrameShape[] =>
  Object.values(getPersistedCanvasStore(pageUid)).filter(
    (record): record is TLFrameShape =>
      record.typeName === "shape" && (record as TLShape).type === "frame",
  );

export const useRoamStore = ({
  customShapeUtils,
  customBindingUtils,
  pageUid,
  migrations,
}: {
  customShapeUtils: readonly TLAnyShapeUtilConstructor[];
  customBindingUtils: readonly TLAnyBindingUtilConstructor[];
  pageUid: string;
  migrations: MigrationSequence[];
}) => {
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [oldData, setOldData] = useState<SerializedStore<TLRecord> | null>(
    null,
  );
  const [initialSnapshot, setInitialSnapshot] =
    useState<TLStoreSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  const localStateIds = useRef<string[]>([]);
  const serializeRef = useRef(0);
  const deserializeRef = useRef(0);
  const tree = useMemo(() => getBasicTreeByParentUid(pageUid), [pageUid]);

  // Handle initial data
  useEffect(() => {
    const persisted = getSubTree({ parentUid: pageUid, tree, key: "State" });
    if (!persisted.uid) {
      void createBlock({ node: { text: "State" }, parentUid: pageUid });
    }
    const { initialSnapshot, oldData } = getPersistedRoamCanvasState({
      pageUid,
    });
    if (initialSnapshot) {
      setInitialSnapshot(initialSnapshot);
      setLoading(false);
    } else if (oldData) {
      setNeedsUpgrade(true);
      setOldData(oldData);
      setLoading(false);
    } else {
      // Create a new store
      setInitialSnapshot(null);
      setLoading(false);
    }
  }, [tree, pageUid]);

  const store = useMemo(() => {
    if (needsUpgrade || error || loading) return null;

    const handleStoreError = ({
      error,
      type,
    }: {
      error: Error;
      type: string;
    }): void => {
      setError(error);
      setLoading(false);
      const snapshotSize = initialSnapshot
        ? JSON.stringify(initialSnapshot).length
        : 0;
      internalError({
        error,
        type,
        context: {
          pageUid,
          snapshotSize,
          ...(snapshotSize < 10000 ? { initialSnapshot } : {}),
        },
      });
    };

    let _store: TLStore;

    try {
      _store = createCanvasStore({
        migrations,
        customShapeUtils,
        customBindingUtils,
      });
    } catch (e) {
      handleStoreError({
        error: e as Error,
        type: "Failed to create TLStore",
      });
      return null;
    }

    if (initialSnapshot) {
      try {
        loadSnapshot(_store, initialSnapshot);
      } catch (e) {
        handleStoreError({
          error: e as Error,
          type: "Failed to migrate snapshot",
        });
        return null;
      }
    }

    _store.listen((rec) => {
      if (rec.source !== "user") return;
      const validChanges = Object.keys(rec.changes.added)
        .concat(Object.keys(rec.changes.removed))
        .concat(Object.keys(rec.changes.updated))
        .filter(
          (k) =>
            !/^(user_presence|camera|instance|instance_page_state|pointer):/.test(
              k,
            ),
        );
      if (!validChanges.length) return;
      clearTimeout(serializeRef.current);
      // TODO
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      serializeRef.current = window.setTimeout(async () => {
        const state = _store.serialize();
        const props = getBlockProps(pageUid) as Record<string, unknown>;
        const rjsqb =
          typeof props["roamjs-query-builder"] === "object"
            ? (props["roamjs-query-builder"] as Record<string, unknown>)
            : {};
        const propSchema = isTLStoreSnapshot(rjsqb.tldraw)
          ? rjsqb.tldraw.schema
          : {};
        const schema =
          Object.keys(propSchema).length === 0
            ? _store.schema.serialize()
            : propSchema;
        await setInputSetting({
          blockUid: pageUid,
          key: "timestamp",
          value: new Date().valueOf().toString(),
        });
        const newstateId = nanoid();
        localStateIds.current.push(newstateId);
        localStateIds.current.splice(0, localStateIds.current.length - 25);
        void window.roamAlphaAPI.data.page.update({
          page: {
            uid: pageUid,
            props: {
              ...props,
              ["roamjs-query-builder"]: {
                ...rjsqb,
                stateId: newstateId,
                tldraw: { store: state, schema },
              },
            },
          },
        });
      }, THROTTLE);
    });
    return _store;
  }, [
    initialSnapshot,
    serializeRef,
    needsUpgrade,
    error,
    loading,
    customShapeUtils,
    customBindingUtils,
    migrations,
    pageUid,
  ]);

  const performUpgrade = () => {
    if (!oldData) return;
    try {
      const snapshot = upgradeLegacyStoreSnapshot({
        oldData,
        migrations,
        customShapeUtils,
        customBindingUtils,
      });
      const props = getBlockProps(pageUid) as Record<string, unknown>;
      const rjsqb =
        typeof props["roamjs-query-builder"] === "object"
          ? (props["roamjs-query-builder"] as Record<string, unknown>)
          : {};
      void window.roamAlphaAPI.data.page.update({
        page: {
          uid: pageUid,
          props: {
            ...props,
            ["roamjs-query-builder"]: {
              ...rjsqb,
              stateId: nanoid(),
              tldraw: snapshot,
              legacyTldraw: {
                date: new Date().valueOf().toString(),
                store: oldData,
              },
            },
          },
        },
      });
      setInitialSnapshot(snapshot);
      setNeedsUpgrade(false);
      setOldData(null);
    } catch (e) {
      const error = e as Error;
      setNeedsUpgrade(false);
      setInitialSnapshot(null);
      setError(error);
      internalError({
        error,
        type: "Failed to perform Canvas upgrade",
        context: {
          data: { oldData },
        },
      });
    }
  };

  // Remote Changes
  useEffect(() => {
    const pullWatchProps: Parameters<AddPullWatch> = [
      "[:edit/user :block/props :block/string {:block/children ...}]",
      `[:block/uid "${pageUid}"]`,
      (_, after) => {
        const props = normalizeProps(
          (after?.[":block/props"] || {}) as json,
        ) as Record<string, json>;
        const rjsqb = props["roamjs-query-builder"] as Record<string, unknown>;
        // Any pending merge was computed from an older props state than this
        // invocation, so always cancel it — including when the newest state is
        // our own save. (Returning early while a stale timer kept running used
        // to let an outdated snapshot clobber just-saved local edits.)
        clearTimeout(deserializeRef.current);
        const propsStateId = rjsqb?.stateId as string;
        if (localStateIds.current.some((s) => s === propsStateId)) return;
        const newState = rjsqb?.tldraw as
          | TLStoreSnapshot
          | SerializedStore<TLRecord>;
        if (!newState) return;
        deserializeRef.current = window.setTimeout(() => {
          if (!store) return;
          const result = mergeRemoteCanvasState({
            store,
            remoteTldraw: newState,
          });
          if (result.type === "applied") {
            if (result.droppedRecordIds.length) {
              console.warn(
                "Canvas remote merge skipped records the current schema rejects:",
                result.droppedRecordIds,
              );
            }
          } else {
            // Skipping a merge leaves the canvas slightly stale until the next
            // save; that beats letting a ValidationError tear down the page.
            internalError({
              error:
                result.type === "apply-failed"
                  ? result.error
                  : new Error("Failed to migrate remote canvas snapshot"),
              type: "Failed to merge remote canvas changes",
              context: { pageUid },
            });
          }
        }, THROTTLE);
      },
    ];
    window.roamAlphaAPI.data.addPullWatch(...pullWatchProps);
    return () => {
      window.roamAlphaAPI.data.removePullWatch(...pullWatchProps);
    };
  }, [pageUid, store]);

  return { error, store, needsUpgrade, performUpgrade };
};
