import type { TLAssetStore } from "tldraw";
import { uniqueId } from "tldraw";

/**
 * Minimal asset store for tldraw-sync-cloudflare backend.
 * Uploads to /uploads/ on the sync worker; resolves via the returned URL.
 */
export const createCloudflareSyncAssetStore = (
  wsBaseUrl: string,
): TLAssetStore => {
  const uploadBase = `${wsBaseUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:")}/uploads`;
  return {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    upload: async (_asset, file) => {
      const id = uniqueId();
      const objectName = `${id}-${file.name}`.replace(/[^a-zA-Z0-9.]/g, "-");
      const url = `${uploadBase}/${objectName}`;
      const response = await fetch(url, { method: "POST", body: file });
      if (!response.ok) {
        throw new Error(`Failed to upload asset: ${response.statusText}`);
      }
      return url;
    },
    resolve: (asset) => asset.props.src,
  };
};
