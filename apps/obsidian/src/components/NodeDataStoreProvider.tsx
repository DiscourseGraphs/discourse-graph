import React, { PropsWithChildren, useContext, useEffect, useMemo } from "react";
import type { App, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { createNodeSnapshotStore, NodeSnapshotStore } from "~/utils/nodeSnapshotStore";

const nodeDataStoreContext = React.createContext<NodeSnapshotStore | null>(null);

export const useNodeDataStore = (): NodeSnapshotStore => {
  const nodeDataStore = useContext(nodeDataStoreContext);
  if (!nodeDataStore) throw new Error("NodeDataStoreProvider missing");
  return nodeDataStore;
}

/**
 * Provider that creates and scopes a `NodeSnapshotStore` to a TLDraw canvas file.
 */
export const NodeDataStoreProvider = ({
  app,
  canvasFile,
  plugin,
  children,
}: PropsWithChildren<{ app: App; canvasFile: TFile; plugin: DiscourseGraphPlugin }>) => {
  const nodeDataStore = useMemo(() => createNodeSnapshotStore({ app, canvasFile, plugin }), [app, canvasFile, plugin]);
  useEffect(() => {
    return () => {
      nodeDataStore.dispose();
    };
  }, [nodeDataStore]);
  return <nodeDataStoreContext.Provider value={nodeDataStore}>{children}</nodeDataStoreContext.Provider>;
}


