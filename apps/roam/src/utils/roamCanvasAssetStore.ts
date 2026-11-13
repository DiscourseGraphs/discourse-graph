import posthog from "posthog-js";
import type { TLAssetStore } from "tldraw";

/**
 * `roamAlphaAPI.file.upload` doesn't resolve to a bare url. It resolves to
 * whatever Roam markup renders that file, and the markup depends on the file
 * type: `![](url)` for an image, `{{[[video]]: url}}` for a video,
 * `{{[[audio]]: url}}`, `{{[[pdf]]: url}}`, `[name](url)` for anything else.
 * The canvas wants the url on its own, so pull it back out of the wrapper
 * rather than stripping any one wrapper's punctuation.
 */
export const parseRoamUploadResponse = (value: string): string => {
  const url = value.match(/https?:\/\/[^\s)}\]]+/)?.[0];
  return url ?? value.trim();
};

/**
 * Upload one canvas file to Roam's file store and return the url to put in an
 * asset's `src`. Every canvas upload goes through here, whether it came from a
 * drop, a paste, or the asset store.
 *
 * Throws when Roam's response has no url in it. A src that isn't a url only
 * fails later, inside `store.put`, which is past the point the caller can catch
 * it — the canvas dies with an error boundary. Failing here keeps the blast
 * radius to the one file.
 */
export const uploadCanvasFileToRoam = async (
  file: File,
  source: "file-drop" | "svg-paste" = "file-drop",
): Promise<string> => {
  const response = await window.roamAlphaAPI.file.upload({ file });
  const src = parseRoamUploadResponse(response);

  if (!/^https?:\/\//.test(src)) {
    throw new Error(
      `Could not find a url in Roam's upload response for ${file.name}: ${response}`,
    );
  }

  posthog.capture("Canvas: Asset Added", { source, mimeType: file.type });
  return src;
};

/**
 * The canvas's asset store: uploads canvas media to Roam's file store instead of
 * inlining it as base64 (tldraw's default), which would bloat the page's block
 * props.
 *
 * This is deliberately the *only* thing we customize about asset handling. Every
 * caller of `editor.uploadAsset` funnels through here — tldraw's own external
 * content handlers own the rest: iterating a multi-file drop, enforcing size and
 * mime-type limits, and placing the resulting shapes. Overriding a layer above
 * this is what made multi-image drops drop all but the first image (ENG-2149).
 */
export const createRoamAssetStore = (): TLAssetStore => ({
  upload: (_asset, file) => uploadCanvasFileToRoam(file),
  resolve: (asset) => asset.props.src,
});
