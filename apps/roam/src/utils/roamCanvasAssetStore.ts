import type { TLAssetStore } from "tldraw";

/**
 * `roamAlphaAPI.file.upload` resolves to a markdown image (`![](url)`), but the
 * canvas needs the bare url to put in `asset.props.src`.
 */
export const parseRoamUploadResponse = (value: string): string =>
  value.replace(/^!\[\]\(/, "").replace(/\)$/, "");

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
export const createRoamAssetStore = ({
  onUpload,
}: {
  /** Fired after each successful upload. Used for telemetry; never throws. */
  onUpload?: (args: { file: File }) => void;
} = {}): TLAssetStore => ({
  upload: async (_asset, file) => {
    const response = await window.roamAlphaAPI.file.upload({ file });
    try {
      onUpload?.({ file });
    } catch (error) {
      console.error("Canvas asset upload telemetry failed", error);
    }
    return parseRoamUploadResponse(response);
  },
  resolve: (asset) => asset.props.src,
});
