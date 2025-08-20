import { useSyncExternalStore } from "react";
import { useNodeDataStore } from "~/components/NodeDataStoreProvider";
import type { NodeSnapshot } from "~/utils/nodeSnapshotStore";

export const useNodeData = (src: string | null): NodeSnapshot => {
  const nodeDataStore = useNodeDataStore();
  return useSyncExternalStore(
    (callback) => nodeDataStore.subscribe(src, callback),
    () => nodeDataStore.get(src),
    () => nodeDataStore.get(src),
  );
}


