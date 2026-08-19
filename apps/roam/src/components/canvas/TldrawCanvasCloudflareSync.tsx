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
import { getCurrentRoamTldrawUserInfo } from "~/utils/roamTldrawUserInfo";
import { createRoamAssetStore } from "~/utils/roamCanvasAssetStore";
import { captureCanvasAssetUploaded } from "./canvasAssetTelemetry";

/** Base URL for tldraw-sync-cloudflare worker. Use https (not wss) - useSync upgrades to WebSocket. */
export const TLDRAW_CLOUDFLARE_SYNC_WS_BASE_URL =
  "https://multiplayer-dg-sync.discoursegraphs.workers.dev";

export type CloudflareCanvasStoreAdapterResult = {
  store: TLStoreWithStatus;
  error: Error | null;
  isLoading: boolean;
};

// TODO: this should be more secure, but using graphName/UID is probably fine for now
export const getSyncRoomId = ({ pageUid }: { pageUid: string }): string => {
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
    () => createRoamAssetStore({ onUpload: captureCanvasAssetUploaded }),
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
  const userInfo = useMemo(() => getCurrentRoamTldrawUserInfo(), []);

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
    userInfo,
  });

  return {
    store,
    error: store.status === "error" ? store.error : null,
    isLoading: store.status === "loading",
  };
};
