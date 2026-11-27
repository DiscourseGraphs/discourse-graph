import { TLDOCUMENT_ID, TLRecord } from "@tldraw/tlschema";
import isEqual from "lodash.isequal";
import nanoid from "nanoid";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSubTree from "roamjs-components/util/getSubTree";
import setInputSetting from "roamjs-components/util/setInputSetting";
import createBlock from "roamjs-components/writes/createBlock";
import { json, normalizeProps } from "~/utils/getBlockProps";
import {
  CanvasCompatibilityError,
  getCanvasCompatibilityMessage,
  getCanvasCompatibilityVersion,
  getCanvasQueryBuilderProps,
  isTLStoreSnapshot,
  readCompatibleLocalCanvas,
  readLocalCanvas,
} from "~/utils/canvasCompatibility";
import {
  createTLStore,
  TLAnyBindingUtilConstructor,
  TLAnyShapeUtilConstructor,
} from "@tldraw/editor";
import type { RecordsDiff, SerializedStore } from "@tldraw/store";
import {
  defaultBindingUtils,
  defaultShapeUtils,
  getIndices,
  loadSnapshot,
  MigrationSequence,
  sortByIndex,
  TLShape,
  TLStoreSnapshot,
  TLStore,
} from "tldraw";
import { AddPullWatch } from "roamjs-components/types";
import { LEGACY_SCHEMA } from "~/data/legacyTldrawSchema";
import internalError from "~/utils/internalError";

const THROTTLE = 350;

const fixShapeIndices = (
  data: SerializedStore<TLRecord>,
): SerializedStore<TLRecord> => {
  const shapes = Object.values(data).filter(
    (record): record is TLShape => record.typeName === "shape",
  );

  const sortedShapes = shapes.sort((a, b) => {
    if (a.index !== undefined && b.index !== undefined) {
      return sortByIndex(a, b);
    }
    return a.id.localeCompare(b.id);
  });

  const newIndices = getIndices(shapes.length);

  const fixedShapes = sortedShapes.map((shape, i) => ({
    ...shape,
    index: newIndices[i],
  }));

  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      if (value.typeName === "shape") {
        const updatedShape = fixedShapes.find((s) => s.id === value.id);
        return [key, (updatedShape || value) as TLRecord];
      }
      return [key, value];
    }),
  );
};

const filterUserRecords = (data: SerializedStore<TLRecord>) => {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => {
      return !/^(user_presence|camera|instance|instance_page_state|user|user_document):/.test(
        key,
      );
    }),
  );
};

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
  const { queryBuilder: rjsqb } = readCompatibleLocalCanvas(pageUid);

  if (isTLStoreSnapshot(rjsqb.tldraw))
    return {
      initialSnapshot: rjsqb.tldraw,
      oldData: null,
    };

  return {
    initialSnapshot: null,
    oldData: rjsqb?.tldraw
      ? (rjsqb.tldraw as unknown as SerializedStore<TLRecord>)
      : null,
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

const personalRecordTypes = new Set([
  "camera",
  "instance",
  "instance_page_state",
]);

const pruneState = (
  state: SerializedStore<TLRecord>,
): Record<string, TLRecord> =>
  Object.fromEntries(
    Object.entries(state).filter(
      ([, record]) => !personalRecordTypes.has(record.typeName),
    ),
  );

const calculateDiff = (
  incoming: SerializedStore<TLRecord>,
  current: SerializedStore<TLRecord>,
): RecordsDiff<TLRecord> => {
  const next = pruneState(incoming);
  const previous = pruneState(current);
  const diff: RecordsDiff<TLRecord> = { added: {}, removed: {}, updated: {} };
  for (const record of Object.values(next)) {
    const old = previous[record.id];
    if (!old) diff.added[record.id] = record;
    else if (!isEqual(old, record)) diff.updated[record.id] = [old, record];
  }
  for (const record of Object.values(previous)) {
    if (!next[record.id]) diff.removed[record.id] = record;
  }
  return diff;
};

type LocalCanvasState =
  | { status: "ready"; store: TLStore }
  | { status: "legacy" }
  | { status: "blocked"; message: string }
  | { status: "error"; error: Error };

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
  const storeOptions = { customShapeUtils, customBindingUtils, migrations };
  const openCanvas = (): LocalCanvasState => {
    try {
      const { initialSnapshot, oldData } = getPersistedRoamCanvasState({
        pageUid,
      });
      if (oldData) return { status: "legacy" };
      const store = createCanvasStore(storeOptions);
      if (initialSnapshot) loadSnapshot(store, initialSnapshot);
      return { status: "ready", store };
    } catch (error) {
      return error instanceof CanvasCompatibilityError
        ? { status: "blocked", message: error.message }
        : { status: "error", error: error as Error };
    }
  };

  // The local editor is keyed by page UID. Keep one store for that page through UI rerenders.
  const [canvas, setCanvas] = useState<LocalCanvasState>(openCanvas);
  const blocked = useRef(canvas.status === "blocked");
  const mounted = useRef(false);
  const upgrading = useRef(false);
  const canUseSnapshot = useCallback((snapshot: json | undefined): boolean => {
    if (blocked.current) return false;
    const message = getCanvasCompatibilityMessage(snapshot);
    if (!message) return true;
    // React can render the update screen after another timer or pull-watch callback runs.
    blocked.current = true;
    if (mounted.current) setCanvas({ status: "blocked", message });
    return false;
  }, []);

  const performUpgrade = async (): Promise<boolean> => {
    if (
      !mounted.current ||
      blocked.current ||
      upgrading.current ||
      canvas.status !== "legacy"
    )
      return false;
    upgrading.current = true;
    try {
      const { props, queryBuilder } = readLocalCanvas(pageUid);
      if (!canUseSnapshot(queryBuilder.tldraw)) return false;
      const oldData = queryBuilder.tldraw;
      if (!oldData || isTLStoreSnapshot(oldData)) {
        setCanvas(openCanvas());
        return false;
      }
      const snapshot = upgradeLegacyStoreSnapshot({
        ...storeOptions,
        oldData: oldData as unknown as SerializedStore<TLRecord>,
      });
      await window.roamAlphaAPI.data.page.update({
        page: {
          uid: pageUid,
          props: {
            ...props,
            "roamjs-query-builder": {
              ...queryBuilder,
              stateId: nanoid(),
              tldraw: snapshot,
              legacyTldraw: { date: Date.now().toString(), store: oldData },
            },
          },
        },
      });
      if (!mounted.current || blocked.current) return false;
      const next = openCanvas();
      if (next.status === "blocked") blocked.current = true;
      setCanvas(next);
      return next.status === "ready";
    } catch (error) {
      if (mounted.current && !blocked.current)
        setCanvas({ status: "error", error: error as Error });
      return false;
    } finally {
      upgrading.current = false;
    }
  };

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (canvas.status === "blocked" || canvas.status === "error") return;
    const store = canvas.status === "ready" ? canvas.store : null;
    const localStateIds: string[] = [];
    let saveTimer: number | undefined;
    let applyTimer: number | undefined;
    let active = true;

    const save = async (): Promise<void> => {
      saveTimer = undefined;
      if (!store || blocked.current) return;
      try {
        const { props, queryBuilder } = readLocalCanvas(pageUid);
        if (!canUseSnapshot(queryBuilder.tldraw)) return;
        const savedSchema = isTLStoreSnapshot(queryBuilder.tldraw)
          ? queryBuilder.tldraw.schema
          : null;
        const schema =
          savedSchema && Object.keys(savedSchema).length
            ? savedSchema
            : store.schema.serialize();
        const records = store.serialize();
        const document = records[TLDOCUMENT_ID];
        const savedVersion = getCanvasCompatibilityVersion(queryBuilder.tldraw);
        // A compatible marker can arrive before the debounced pull-watch applies it.
        if (
          typeof savedVersion === "number" &&
          document?.typeName === "document" &&
          (typeof document.meta.canvasCompatibilityVersion !== "number" ||
            document.meta.canvasCompatibilityVersion < savedVersion)
        ) {
          records[TLDOCUMENT_ID] = {
            ...document,
            meta: {
              ...document.meta,
              canvasCompatibilityVersion: savedVersion,
            },
          };
        }
        const stateId = nanoid();
        localStateIds.push(stateId);
        if (localStateIds.length > 25) localStateIds.shift();
        // Submit the snapshot in the same turn as the compatibility check.
        await window.roamAlphaAPI.data.page.update({
          page: {
            uid: pageUid,
            props: {
              ...props,
              "roamjs-query-builder": {
                ...queryBuilder,
                stateId,
                tldraw: { store: records, schema },
              },
            },
          },
        });
        if (canUseSnapshot(readLocalCanvas(pageUid).queryBuilder.tldraw)) {
          await setInputSetting({
            blockUid: pageUid,
            key: "timestamp",
            value: Date.now().toString(),
          });
        }
      } catch (error) {
        internalError({
          error,
          type: "Failed to save local canvas",
          context: { pageUid },
        });
      }
    };

    const unlisten = store?.listen(({ source, changes }) => {
      if (source !== "user" || blocked.current) return;
      const changedIds = [
        ...Object.keys(changes.added),
        ...Object.keys(changes.updated),
        ...Object.keys(changes.removed),
      ];
      if (
        !changedIds.some(
          (id) =>
            !/^(user_presence|camera|instance|instance_page_state|pointer):/.test(
              id,
            ),
        )
      )
        return;
      clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        void save();
      }, THROTTLE);
    });

    const pullWatchProps: Parameters<AddPullWatch> = [
      "[:edit/user :block/props :block/string {:block/children ...}]",
      `[:block/uid "${pageUid}"]`,
      (_, after) => {
        if (!active || blocked.current) return;
        const props = normalizeProps(
          (after?.[":block/props"] || {}) as json,
        ) as Record<string, json>;
        const { tldraw, stateId } = getCanvasQueryBuilderProps(props);
        if (!canUseSnapshot(tldraw)) {
          clearTimeout(saveTimer);
          clearTimeout(applyTimer);
          return;
        }
        if (
          !store ||
          (typeof stateId === "string" && localStateIds.includes(stateId)) ||
          !isTLStoreSnapshot(tldraw)
        )
          return;
        clearTimeout(applyTimer);
        applyTimer = window.setTimeout(() => {
          if (!active) return;
          const current = readLocalCanvas(pageUid).queryBuilder;
          if (
            !canUseSnapshot(current.tldraw) ||
            current.stateId !== stateId ||
            !isTLStoreSnapshot(current.tldraw)
          )
            return;
          const records = current.tldraw.store;
          store.mergeRemoteChanges(() => {
            store.applyDiff(calculateDiff(records, store.getSnapshot().store));
          });
        }, THROTTLE);
      },
    ];
    window.roamAlphaAPI.data.addPullWatch(...pullWatchProps);
    if (canUseSnapshot(readLocalCanvas(pageUid).queryBuilder.tldraw)) {
      const tree = getBasicTreeByParentUid(pageUid);
      if (!getSubTree({ parentUid: pageUid, tree, key: "State" }).uid) {
        void createBlock({ node: { text: "State" }, parentUid: pageUid });
      }
    }
    return () => {
      active = false;
      // tldraw delivers edits on the next animation frame, which may follow unmount.
      if (!blocked.current) store?._flushHistory();
      unlisten?.();
      window.roamAlphaAPI.data.removePullWatch(...pullWatchProps);
      clearTimeout(applyTimer);
      clearTimeout(saveTimer);
      // Navigation can beat the debounce. Flush only while the old page is still compatible.
      if (saveTimer !== undefined && !blocked.current) void save();
    };
  }, [canvas, pageUid, canUseSnapshot]);

  return {
    store: canvas.status === "ready" ? canvas.store : null,
    compatibilityMessage: canvas.status === "blocked" ? canvas.message : null,
    error: canvas.status === "error" ? canvas.error : null,
    needsUpgrade: canvas.status === "legacy",
    performUpgrade,
  };
};
