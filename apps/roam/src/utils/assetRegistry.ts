import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import { DISCOURSE_GRAPH_PROP_NAME } from "./createReifiedBlock";
import getBlockProps, { type json } from "./getBlockProps";
import { setBlockPropsAsync } from "./setBlockProps";

/**
 * A graph-level memo of the assets this graph has already mirrored into Roam storage.
 *
 * `file.upload` is not idempotent, because it writes a fresh random URL on every call. So
 * without a memo an asset referenced by three imported nodes becomes three blobs, and
 * every re-import adds another. Shared storage deduplicates by content hash, so the
 * memo has to key on the hash rather than on the reference, or it re-inflates what the
 * bucket collapsed.
 *
 * It is a cache, not a source of truth: which URLs a page references is recoverable
 * from the page's own blocks, and which asset a URL holds from the file's own name
 * (uploads are named `imported-<sha256>`). A lost registry costs a rebuild, not data.
 */

export const ASSET_REGISTRY_PAGE_TITLE =
  "roam/js/discourse-graph/imported-assets";
export const ASSET_REGISTRY_BLOCK_TEXT = "Sync Asset Registry";
export const ASSET_REGISTRY_PROP_KEY = "assetRegistry";

/** SHA-256 of the shared-storage bytes -> the URL of this graph's own copy. */
export type AssetRegistry = Record<string, string>;

const isJsonObject = (value: json | undefined): value is Record<string, json> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const findRegistryBlockUid = (): string | undefined => {
  const pageUid = getPageUidByPageTitle(ASSET_REGISTRY_PAGE_TITLE);
  if (!pageUid) return undefined;
  return getShallowTreeByParentUid(pageUid).find(
    ({ text }) => text === ASSET_REGISTRY_BLOCK_TEXT,
  )?.uid;
};

const getOrCreateRegistryBlockUid = async (): Promise<string> => {
  const existing = findRegistryBlockUid();
  if (existing) return existing;

  const pageUid =
    getPageUidByPageTitle(ASSET_REGISTRY_PAGE_TITLE) ||
    (await createPage({ title: ASSET_REGISTRY_PAGE_TITLE }));

  return createBlock({
    node: { text: ASSET_REGISTRY_BLOCK_TEXT },
    parentUid: pageUid,
    order: "last",
  });
};

const registryFromProps = (blockUid: string): AssetRegistry => {
  const discourseGraphProps =
    getBlockProps(blockUid)[DISCOURSE_GRAPH_PROP_NAME];
  if (!isJsonObject(discourseGraphProps)) return {};

  const registry = discourseGraphProps[ASSET_REGISTRY_PROP_KEY];
  if (!isJsonObject(registry)) return {};

  return Object.fromEntries(
    Object.entries(registry).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
};

/**
 * Reads the registry without touching the graph. An absent page or block is an empty
 * registry, not something to create. Only a write brings the page into being.
 */
export const readAssetRegistry = (): AssetRegistry => {
  const blockUid = findRegistryBlockUid();
  return blockUid ? registryFromProps(blockUid) : {};
};

export const readMirroredAssetUrl = (contentHash: string): string | undefined =>
  readAssetRegistry()[contentHash];

/**
 * Records the URL of this graph's copy of an asset, creating the registry page and
 * block if they are absent. Merges into the props read back at call time so a
 * concurrent write to another key is not dropped.
 */
export const recordMirroredAsset = async ({
  contentHash,
  url,
}: {
  contentHash: string;
  url: string;
}): Promise<void> => {
  const blockUid = await getOrCreateRegistryBlockUid();
  const discourseGraphProps =
    getBlockProps(blockUid)[DISCOURSE_GRAPH_PROP_NAME];

  await setBlockPropsAsync(blockUid, {
    [DISCOURSE_GRAPH_PROP_NAME]: {
      ...(isJsonObject(discourseGraphProps) ? discourseGraphProps : {}),
      [ASSET_REGISTRY_PROP_KEY]: {
        ...registryFromProps(blockUid),
        [contentHash]: url,
      },
    },
  });
};
