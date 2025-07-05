import { TLRecord } from "@tldraw/tlschema";
import nanoid from "nanoid";
import { useRef, useMemo, useEffect, useState } from "react";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSubTree from "roamjs-components/util/getSubTree";
import setInputSetting from "roamjs-components/util/setInputSetting";
import createBlock from "roamjs-components/writes/createBlock";
import getBlockProps, { json, normalizeProps } from "~/utils/getBlockProps";
import { createTLStore } from "@tldraw/editor";
import { SerializedStore, StoreSnapshot } from "@tldraw/store";
import {
  defaultBindingUtils,
  defaultShapeUtils,
  getIndices,
  loadSnapshot,
  MigrationSequence,
  sortByIndex,
  TLShape,
  TLStoreSnapshot,
} from "tldraw";
import { AddPullWatch } from "roamjs-components/types";
import { LEGACY_SCHEMA } from "~/data/legacyTldrawSchema";
import apiPost from "roamjs-components/util/apiPost";

const THROTTLE = 350;

const isTLStoreSnapshot = (value: unknown): value is TLStoreSnapshot => {
  return (
    typeof value === "object" &&
    value !== null &&
    "store" in value &&
    "schema" in value
  );
};

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
        return [key, updatedShape || value];
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

export const useRoamStore = ({
  customShapeUtils,
  customBindingUtils,
  pageUid,
  migrations,
}: {
  customShapeUtils: any[];
  customBindingUtils: any[];
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
      createBlock({ node: { text: "State" }, parentUid: pageUid });
    }
    const props = getBlockProps(pageUid) as Record<string, unknown>;
    const rjsqb =
      typeof props["roamjs-query-builder"] === "object"
        ? (props["roamjs-query-builder"] as Record<string, unknown>)
        : {};
    if (isTLStoreSnapshot(rjsqb.tldraw)) {
      setInitialSnapshot(rjsqb.tldraw as TLStoreSnapshot);
      setLoading(false);
    } else if (rjsqb?.tldraw) {
      const oldStore = rjsqb.tldraw as SerializedStore<TLRecord>;
      setNeedsUpgrade(true);
      setOldData(oldStore);
      setLoading(false);
    } else {
      // Create a new store
      setInitialSnapshot(null);
      setLoading(false);
    }
  }, [tree, pageUid]);
  const store = useMemo(() => {
    if (needsUpgrade || error || loading) return null;
    let _store;
    try {
      _store = createTLStore({
        initialData: initialSnapshot?.store,
        migrations: migrations,
        shapeUtils: [...defaultShapeUtils, ...customShapeUtils],
        bindingUtils: [...defaultBindingUtils, ...customBindingUtils],
      });
    } catch (error) {
      console.error("Failed to create store:", error);
      return null;
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
        window.roamAlphaAPI.updateBlock({
          block: {
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
  }, [initialSnapshot, serializeRef, needsUpgrade, error, loading]);

  const personalRecordTypes = new Set([
    "camera",
    "instance",
    "instance_page_state",
  ]);

  const performUpgrade = async () => {
    if (!oldData) return;
    try {
      const newStore = createTLStore({
        migrations: migrations,
        shapeUtils: [...defaultShapeUtils, ...customShapeUtils],
        bindingUtils: [...defaultBindingUtils, ...customBindingUtils],
      });
      const filteredData = filterUserRecords(oldData);
      const dataWithFixedShapes = fixShapeIndices(filteredData);

      loadSnapshot(newStore, {
        store: dataWithFixedShapes,
        schema: LEGACY_SCHEMA,
      });
      const snapshot = newStore.getStoreSnapshot();
      const props = getBlockProps(pageUid) as Record<string, unknown>;
      const rjsqb =
        typeof props["roamjs-query-builder"] === "object"
          ? (props["roamjs-query-builder"] as Record<string, unknown>)
          : {};
      window.roamAlphaAPI.updateBlock({
        block: {
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
      setError(error as Error);
      apiPost({
        domain: "https://api.samepage.network",
        path: "errors",
        data: {
          method: "extension-error",
          type: "Failed to perform Canvas upgrade",
          data: { oldData },
          message: error.message,
          stack: error.stack,
          version: process.env.VERSION,
          notebookUuid: JSON.stringify({
            owner: "RoamJS",
            app: "query-builder",
            workspace: window.roamAlphaAPI.graph.name,
          }),
        },
      }).catch(() => {});
      console.error("Failed to perform Canvas upgrade", error);
    }
  };

  const pruneState = (state: SerializedStore<TLRecord>) =>
    Object.fromEntries(
      Object.entries(state).filter(
        ([_, record]) => !personalRecordTypes.has(record.typeName),
      ),
    );

  const diffObjects = (
    oldRecord: Record<string, any>,
    newRecord: Record<string, any>,
  ): Record<string, any> => {
    const allKeys = Array.from(
      new Set(Object.keys(oldRecord).concat(Object.keys(newRecord))),
    );
    return Object.fromEntries(
      allKeys
        .map((key) => {
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
            const diffed = diffObjects(oldValue, newValue);
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
        .filter((e): e is [string, any] => !!e),
    );
  };
  const calculateDiff = (
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
          .map((id) => {
            const oldRecord = oldState[id];
            const newRecord = newState[id];
            if (!oldRecord || !newRecord) {
              return null;
            }

            const diffed = diffObjects(oldRecord, newRecord);
            if (Object.keys(diffed).length) {
              return [id, [oldRecord, newRecord]];
            }
            return null;
          })
          .filter((e): e is [string, any] => !!e),
      ),
    };
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
        const propsStateId = rjsqb?.stateId as string;
        if (localStateIds.current.some((s) => s === propsStateId)) return;
        const newState = rjsqb?.tldraw as StoreSnapshot<TLRecord>;
        if (!newState) return;
        clearTimeout(deserializeRef.current);
        deserializeRef.current = window.setTimeout(() => {
          if (!store) return;
          store.mergeRemoteChanges(() => {
            const currentState = store.getSnapshot();
            const diff = calculateDiff(newState.store, currentState.store);
            store.applyDiff(diff);
          });
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
