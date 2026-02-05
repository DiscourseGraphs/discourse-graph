/* eslint-disable @typescript-eslint/naming-convention */
import React from "react";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import { multiplayerAssetStore } from "./multiplayerAssetStore";
import { useSync } from "@tldraw/sync";

/** When true, newly created canvases (no Roam-persisted state) use tldraw sync via Cloudflare. PoC only. */
export const TLDRAW_CLOUDFLARE_SYNC_ENABLED = true;
/** Base URL for tldraw-sync-cloudflare worker. Use https (not wss) - useSync upgrades to WebSocket. */
export const TLDRAW_CLOUDFLARE_SYNC_WS_BASE_URL =
  "https://multiplayer-template-246.discoursegraphs.workers.dev";

export const TldrawCanvasCloudflareSync = ({
  pageUid,
}: {
  pageUid: string;
}) => {
  const store = useSync({
    uri: `${TLDRAW_CLOUDFLARE_SYNC_WS_BASE_URL}/connect/${pageUid}`,
    assets: multiplayerAssetStore,
  });

  return <Tldraw store={store} />;
};
