import posthog from "posthog-js";

/**
 * Fired once per file uploaded to the canvas. Both canvas store adapters (local
 * block-props and Cloudflare sync) route their uploads through the same asset
 * store, so this is the single place assets are counted. The "file-drop" source
 * covers drops and pastes alike, matching what this event has always reported.
 */
export const captureCanvasAssetUploaded = ({ file }: { file: File }): void => {
  posthog.capture("Canvas: Asset Added", {
    source: "file-drop",
    mimeType: file.type,
  });
};
