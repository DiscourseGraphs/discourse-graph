import { useSync } from "@tldraw/sync";
import {
  TLAnyBindingUtilConstructor,
  TLAnyShapeUtilConstructor,
  TLStoreWithStatus,
  defaultBindingUtils,
  defaultShapeUtils,
  MigrationSequence,
} from "tldraw";
import { useMemo } from "react";
import { createCloudflareSyncAssetStore } from "./cloudflareSyncAssetStore";

/** When true, newly created canvases (no Roam-persisted state) use tldraw sync via Cloudflare. PoC only. */
export const TLDRAW_CLOUDFLARE_SYNC_ENABLED = true;
/** Base URL for tldraw-sync-cloudflare worker. Use https (not wss) - useSync upgrades to WebSocket. */
export const TLDRAW_CLOUDFLARE_SYNC_WS_BASE_URL =
  "https://multiplayer-dg-sync-poc.discoursegraphs.workers.dev";

export type CloudflareCanvasStoreAdapterResult = {
  store: TLStoreWithStatus;
  error: Error | null;
  isLoading: boolean;
};

export const useCloudflareSyncStore = ({
  pageUid,
  migrations,
  customShapeUtils,
  customBindingUtils,
  customShapeTypes,
  customBindingTypes,
}: {
  pageUid: string;
  migrations: MigrationSequence[];
  customShapeUtils: readonly TLAnyShapeUtilConstructor[];
  customBindingUtils: readonly TLAnyBindingUtilConstructor[];
  customShapeTypes: string[];
  customBindingTypes: string[];
}): CloudflareCanvasStoreAdapterResult => {
  const assets = useMemo(
    () => createCloudflareSyncAssetStore(TLDRAW_CLOUDFLARE_SYNC_WS_BASE_URL),
    [],
  );
  const shapeUtils = useMemo(
    () => [...defaultShapeUtils, ...customShapeUtils],
    [customShapeUtils],
  );
  const bindingUtils = useMemo(
    () => [...defaultBindingUtils, ...customBindingUtils],
    [customBindingUtils],
  );

  const uri = useMemo(() => {
    const query = new URLSearchParams();
    for (const shapeType of customShapeTypes) {
      query.append("shapeType", shapeType);
    }
    for (const bindingType of customBindingTypes) {
      query.append("bindingType", bindingType);
    }
    return `${TLDRAW_CLOUDFLARE_SYNC_WS_BASE_URL}/connect/${pageUid}?${query.toString()}`;
  }, [customShapeTypes, customBindingTypes, pageUid]);

  const store = useSync({
    uri,
    assets,
    migrations,
    shapeUtils,
    bindingUtils,
  });

  return {
    store,
    error: store.status === "error" ? store.error : null,
    isLoading: store.status === "loading",
  };
};
