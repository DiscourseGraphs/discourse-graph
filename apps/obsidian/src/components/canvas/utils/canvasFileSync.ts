import {
  RecordsDiff,
  SerializedSchema,
  SerializedStore,
  TLRecord,
  TLStore,
  TLStoreSnapshot,
} from "tldraw";
import { TLDATA_DELIMITER_END, TLDATA_DELIMITER_START } from "~/constants";
import { TLData } from "./tldraw";

/**
 * The canvas data block of the backing markdown file as a tab last saw it.
 * `text` is the exact JSON inside the delimiters so it can be compared
 * byte-for-byte against what we write and what arrives from disk.
 */
export type CanvasFileState = {
  text: string;
  data: TLData;
};

const TLDATA_BLOCK_REGEX = new RegExp(
  `${TLDATA_DELIMITER_START}\\s*([\\s\\S]*?)\\s*${TLDATA_DELIMITER_END}`,
);

export const parseCanvasFileState = (
  content: string,
): CanvasFileState | null => {
  const text = content.match(TLDATA_BLOCK_REGEX)?.[1];
  if (!text) return null;
  try {
    const data = JSON.parse(text) as TLData;
    if (!data.raw) return null;
    return { text, data };
  } catch {
    // A sync client may deliver a half-written file; wait for the next event.
    return null;
  }
};

export const toSerializedStore = (
  records: unknown,
): SerializedStore<TLRecord> => {
  if (Array.isArray(records)) {
    return Object.fromEntries(
      (records as TLRecord[]).map((record) => [record.id, record]),
    ) as SerializedStore<TLRecord>;
  }
  return (records ?? {}) as SerializedStore<TLRecord>;
};

/**
 * Migrates the records in a file to the store's current schema and drops
 * session-scoped records (camera, selection, pointer). Those belong to a
 * single tab and must never travel between tabs or machines.
 */
export const readDocumentRecords = ({
  store,
  data,
}: {
  store: TLStore;
  data: TLData;
}): SerializedStore<TLRecord> | null => {
  const snapshot: TLStoreSnapshot = {
    store: toSerializedStore(data.raw.records),
    schema: (data.raw.schema ?? store.schema.serialize()) as SerializedSchema,
  };
  const migration = store.schema.migrateStoreSnapshot(snapshot);
  if (migration.type !== "success") return null;

  return Object.fromEntries(
    Object.entries(migration.value).filter(([, record]) =>
      store.scopedTypes.document.has(record.typeName),
    ),
  ) as SerializedStore<TLRecord>;
};

const isDeepEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null ||
    Array.isArray(a) !== Array.isArray(b)
  ) {
    return false;
  }
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  if (aKeys.length !== Object.keys(bRecord).length) return false;
  return aKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(bRecord, key) &&
      isDeepEqual(aRecord[key], bRecord[key]),
  );
};

type RecordId = TLRecord["id"];

/**
 * Record-level three-way merge. Only records the other side changed
 * relative to `base` are applied, so edits made locally since `base`
 * survive an incoming update. When both sides changed the same record the
 * incoming one wins; field-level conflict resolution is out of scope.
 */
export const calculateThreeWayDiff = ({
  base,
  incoming,
  current,
}: {
  base: SerializedStore<TLRecord>;
  incoming: SerializedStore<TLRecord>;
  current: SerializedStore<TLRecord>;
}): RecordsDiff<TLRecord> => {
  const diff: RecordsDiff<TLRecord> = { added: {}, updated: {}, removed: {} };

  for (const [id, incomingRecord] of Object.entries(incoming) as [
    RecordId,
    TLRecord,
  ][]) {
    const baseRecord = base[id];
    if (baseRecord && isDeepEqual(baseRecord, incomingRecord)) continue;

    const currentRecord = current[id];
    if (!currentRecord) {
      diff.added[id] = incomingRecord;
    } else if (!isDeepEqual(currentRecord, incomingRecord)) {
      diff.updated[id] = [currentRecord, incomingRecord];
    }
  }

  for (const id of Object.keys(base) as RecordId[]) {
    if (incoming[id]) continue;
    const currentRecord = current[id];
    if (currentRecord) diff.removed[id] = currentRecord;
  }

  return diff;
};

const isDiffEmpty = (diff: RecordsDiff<TLRecord>): boolean =>
  Object.keys(diff.added).length === 0 &&
  Object.keys(diff.updated).length === 0 &&
  Object.keys(diff.removed).length === 0;

/**
 * Brings `store` up to date with `incoming` without disturbing the tab's
 * camera, selection, or undo history. The merge runs as a remote change, so
 * store listeners filtered to `source: "user"` (including the save loop)
 * do not fire for it.
 *
 * Returns false when the incoming data cannot be read; the caller should
 * keep its previous known state in that case.
 */
export const applyCanvasFileState = ({
  store,
  base,
  incoming,
}: {
  store: TLStore;
  base: CanvasFileState | null;
  incoming: CanvasFileState;
}): boolean => {
  const incomingRecords = readDocumentRecords({ store, data: incoming.data });
  if (!incomingRecords) return false;

  const baseRecords = base
    ? (readDocumentRecords({ store, data: base.data }) ?? {})
    : {};
  const current = store.getStoreSnapshot("document").store;
  const diff = calculateThreeWayDiff({
    base: baseRecords,
    incoming: incomingRecords,
    current,
  });
  if (isDiffEmpty(diff)) return true;

  store.mergeRemoteChanges(() => store.applyDiff(diff));
  return true;
};
