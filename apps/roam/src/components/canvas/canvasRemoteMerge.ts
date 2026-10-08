// Merging persisted canvas state from Roam block props into a live tldraw
// store (the pull-watch "remote changes" path of useRoamStore).
//
// The persisted store is raw: it may predate the live schema (e.g. legacy
// node-uid shape types that MigrateNodeTypeToDiscourseNode retypes to
// "discourse-node" on load). `store.applyDiff` validates records against the
// live schema but never migrates them, so the incoming state must run through
// the same migration machinery `loadSnapshot` uses on mount before diffing —
// otherwise a single stale record throws a ValidationError inside
// `mergeRemoteChanges` and tears the canvas down.
import { TLRecord } from "@tldraw/tlschema";
import { SerializedStore } from "@tldraw/store";
import {
  getIndices,
  sortByIndex,
  TLShape,
  TLStore,
  TLStoreSnapshot,
} from "tldraw";
import { LEGACY_SCHEMA } from "~/data/legacyTldrawSchema";

export const isTLStoreSnapshot = (value: unknown): value is TLStoreSnapshot => {
  return (
    typeof value === "object" &&
    value !== null &&
    "store" in value &&
    "schema" in value
  );
};

export const fixShapeIndices = (
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

export const filterUserRecords = (
  data: SerializedStore<TLRecord>,
): SerializedStore<TLRecord> => {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => {
      return !/^(user_presence|camera|instance|instance_page_state|user|user_document):/.test(
        key,
      );
    }),
  );
};

const personalRecordTypes = new Set([
  "camera",
  "instance",
  "instance_page_state",
]);

const pruneState = (state: SerializedStore<TLRecord>) =>
  Object.fromEntries(
    Object.entries(state).filter(
      ([, record]) => !personalRecordTypes.has(record.typeName),
    ),
  );

const diffObjects = (
  oldRecord: Record<string, unknown>,
  newRecord: Record<string, unknown>,
): Record<string, unknown> => {
  const allKeys = Array.from(
    new Set(Object.keys(oldRecord).concat(Object.keys(newRecord))),
  );
  return Object.fromEntries(
    allKeys
      .map((key): [string, unknown] | null => {
        const oldValue = oldRecord[key];
        const newValue = newRecord[key];
        if (typeof oldValue !== typeof newValue) {
          return [key, newValue];
        }
        if (
          typeof oldValue === "object" &&
          oldValue !== null &&
          newValue !== null
        ) {
          // Both branches are non-null objects (their `typeof` matched above).
          const diffed = diffObjects(
            oldValue as Record<string, unknown>,
            newValue as Record<string, unknown>,
          );
          if (Object.keys(diffed).length) {
            return [key, diffed];
          }
          return null;
        }
        if (oldValue !== newValue) {
          return [key, newValue];
        }
        return null;
      })
      .filter((e): e is [string, unknown] => !!e),
  );
};

export const calculateDiff = (
  _newState: SerializedStore<TLRecord>,
  _oldState: SerializedStore<TLRecord>,
) => {
  const newState = pruneState(_newState);
  const oldState = pruneState(_oldState);
  return {
    added: Object.fromEntries(
      Object.keys(newState)
        .filter((id) => !oldState[id])
        .map((id) => [id, newState[id]]),
    ),
    removed: Object.fromEntries(
      Object.keys(oldState)
        .filter((id) => !newState[id])
        .map((key) => [key, oldState[key]]),
    ),
    updated: Object.fromEntries(
      Object.keys(newState)
        .map((id): [string, [TLRecord, TLRecord]] | null => {
          const oldRecord = oldState[id];
          const newRecord = newState[id];
          if (!oldRecord || !newRecord) {
            return null;
          }

          const diffed = diffObjects(
            oldRecord as unknown as Record<string, unknown>,
            newRecord as unknown as Record<string, unknown>,
          );
          if (Object.keys(diffed).length) {
            return [id, [oldRecord, newRecord]];
          }
          return null;
        })
        .filter((e): e is [string, [TLRecord, TLRecord]] => !!e),
    ),
  };
};

export type MergeRemoteCanvasStateResult =
  | { type: "applied"; droppedRecordIds: string[] }
  | { type: "migration-failed" }
  | { type: "apply-failed"; error: unknown };

export const mergeRemoteCanvasState = ({
  store,
  remoteTldraw,
}: {
  store: TLStore;
  // The raw `props["roamjs-query-builder"].tldraw` value: a modern
  // `{ store, schema }` snapshot, or a bare legacy serialized store.
  remoteTldraw: TLStoreSnapshot | SerializedStore<TLRecord>;
}): MergeRemoteCanvasStateResult => {
  // Legacy-format data gets the same pre-processing the mount path
  // (upgradeLegacyStoreSnapshot) applies before migrating.
  const snapshot: TLStoreSnapshot = isTLStoreSnapshot(remoteTldraw)
    ? remoteTldraw
    : {
        store: fixShapeIndices(filterUserRecords(remoteTldraw)),
        schema: LEGACY_SCHEMA,
      };

  const migration = store.schema.migrateStoreSnapshot(snapshot);
  if (migration.type !== "success") {
    return { type: "migration-failed" };
  }

  // Keep only document-scoped records (what loadSnapshot keeps) and drop any
  // record the live schema still rejects after migration — e.g. a shape whose
  // node type is missing from this graph's config, which no migration can
  // retype. A dropped record must not be treated as remotely deleted, so its
  // id is also excluded from the diff's `removed` set below.
  const droppedRecordIds: string[] = [];
  const incoming: SerializedStore<TLRecord> = Object.fromEntries(
    Object.entries(migration.value).filter(([id, record]) => {
      if (!store.scopedTypes.document.has(record.typeName)) return false;
      try {
        store.schema.validateRecord(store, record, "createRecord", null);
        return true;
      } catch {
        droppedRecordIds.push(id);
        return false;
      }
    }),
  );

  try {
    store.mergeRemoteChanges(() => {
      const currentState = store.getSnapshot();
      const diff = calculateDiff(incoming, currentState.store);
      droppedRecordIds.forEach((id) => {
        delete diff.removed[id];
      });
      store.applyDiff(diff);
    });
  } catch (error) {
    return { type: "apply-failed", error };
  }

  return { type: "applied", droppedRecordIds };
};
