import { useSync } from "@tldraw/sync";
import {
  TLAnyBindingUtilConstructor,
  TLAnyShapeUtilConstructor,
  TLAssetStore,
  TLStoreWithStatus,
  defaultBindingUtils,
  defaultShapeUtils,
  MigrationSequence,
} from "tldraw";
import { useMemo } from "react";

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

const getSyncRoomId = ({ pageUid }: { pageUid: string }): string => {
  const graphName = window.roamAlphaAPI.graph.name;
  const payload = JSON.stringify({ graphName, pageUid });
  const bytes = new TextEncoder().encode(payload);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const parseRoamUploadResponse = (value: string): string => {
  return value.replace(/^!\[\]\(/, "").replace(/\)$/, "");
};

const createRoamAssetStore = (): TLAssetStore => {
  return {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    upload: async (_asset, file) => {
      const response = await window.roamAlphaAPI.file.upload({ file });
      return parseRoamUploadResponse(response);
    },
    resolve: (asset) => asset.props.src,
  };
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
  const assets = useMemo(() => createRoamAssetStore(), []);
  const shapeUtils = useMemo(
    () => [...defaultShapeUtils, ...customShapeUtils],
    [customShapeUtils],
  );
  const bindingUtils = useMemo(
    () => [...defaultBindingUtils, ...customBindingUtils],
    [customBindingUtils],
  );

  const uri = useMemo(() => {
    const roomId = getSyncRoomId({ pageUid });
    const query = new URLSearchParams();
    for (const shapeType of customShapeTypes) {
      query.append("shapeType", shapeType);
    }
    for (const bindingType of customBindingTypes) {
      query.append("bindingType", bindingType);
    }
    return `${TLDRAW_CLOUDFLARE_SYNC_WS_BASE_URL}/connect/${roomId}?${query.toString()}`;
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
