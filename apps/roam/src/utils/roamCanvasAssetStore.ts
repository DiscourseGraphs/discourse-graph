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
    const src = parseRoamUploadResponse(response);

    // A src that isn't a url fails the tldraw schema later, inside store.put,
    // which is past the point where the file handler can catch it — the canvas
    // dies with an error boundary. Failing here turns it into a toast for that
    // one file, and the rest of a multi-file drop still lands.
    if (!/^https?:\/\//.test(src)) {
      throw new Error(
        `Could not find a url in Roam's upload response for ${file.name}: ${response}`,
      );
    }

    try {
      onUpload?.({ file });
    } catch (error) {
      console.error("Canvas asset upload telemetry failed", error);
    }
    return src;
  },
  resolve: (asset) => asset.props.src,
});
