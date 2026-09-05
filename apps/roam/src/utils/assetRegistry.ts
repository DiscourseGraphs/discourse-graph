import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import { DISCOURSE_GRAPH_PROP_NAME } from "./createReifiedBlock";
import getBlockProps, { isJsonObject } from "./getBlockProps";
import { setBlockPropsAsync } from "./setBlockProps";
import internalError from "./internalError";

/**
 * A graph-level memo of the assets this graph has already mirrored into Roam storage.
 *
 * `file.upload` writes a fresh random URL on every call, so without a memo an asset
 * referenced by three imported nodes becomes three blobs, and every re-import adds
 * another. It keys on the content hash rather than the reference, because shared storage
 * deduplicates by hash and keying on the reference re-inflates what the bucket collapsed.
 *
 * A cache, not a source of truth: a lost registry costs a rebuild, not data. A page's
 * URLs are recoverable from its own blocks, and a URL's asset from the uploaded file
 * name, `imported-<sha256>`.
 */

export const ASSET_REGISTRY_PAGE_TITLE =
  "roam/js/discourse-graph/imported-assets";
export const ASSET_REGISTRY_BLOCK_TEXT = "Sync Asset Registry";
export const ASSET_REGISTRY_PROP_KEY = "assetRegistry";

/** SHA-256 of the shared-storage bytes -> the URL of this graph's own copy. */
export type AssetRegistry = Record<string, string>;

/**
 * The registry is addressed by page title and block text, both of which a user can edit
 * or delete and neither of which the extension can defend.
 */
const locateRegistry = (): {
  pageUid: string | undefined;
  blockUid: string | undefined;
} => {
  const pageUid = getPageUidByPageTitle(ASSET_REGISTRY_PAGE_TITLE) || undefined;
  if (!pageUid) return { pageUid: undefined, blockUid: undefined };

  return {
    pageUid,
    blockUid: getShallowTreeByParentUid(pageUid).find(
      ({ text }) => text === ASSET_REGISTRY_BLOCK_TEXT,
    )?.uid,
  };
};

/**
 * An orphaned registry is one condition, not one per asset, so a reader looking up N
 * hashes is told once. It is survivable, since the next write recreates the registry,
 * but silent otherwise, and a graph that re-uploads everything it already holds deserves
 * an explanation.
 *
 * Cleared by a reachable registry, so a graph orphaned, repaired, and orphaned again
 * warns twice, which is true both times. Only the detectable half warns: a page that
 * outlived its block. A deleted page is indistinguishable from a graph that has never
 * imported an asset, and Roam reaps a page left with no blocks, so that case passes
 * silently and costs one round of re-uploads.
 */
let hasWarnedOrphanedRegistry = false;

const warnOrphanedRegistry = (): void => {
  if (hasWarnedOrphanedRegistry) return;
  hasWarnedOrphanedRegistry = true;
  internalError({
    type: "Broken asset registry",
    error: `The Discourse Graph asset registry is unreachable: [[${ASSET_REGISTRY_PAGE_TITLE}]] has no block reading "${ASSET_REGISTRY_BLOCK_TEXT}". Anything recorded there is lost, and every asset this graph already holds will be uploaded again.`,
  });
};

const getOrCreateRegistryBlockUid = async (): Promise<string> => {
  const { pageUid, blockUid } = locateRegistry();
  if (blockUid) return blockUid;

  // No warning on this path: it recreates what it found missing, in this same call.
  return createBlock({
    node: { text: ASSET_REGISTRY_BLOCK_TEXT },
    parentUid:
      pageUid ?? (await createPage({ title: ASSET_REGISTRY_PAGE_TITLE })),
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
 * registry, not something to create.
 */
export const readAssetRegistry = (): AssetRegistry => {
  const { pageUid, blockUid } = locateRegistry();
  if (blockUid) {
    hasWarnedOrphanedRegistry = false;
    return registryFromProps(blockUid);
  }
  if (pageUid) warnOrphanedRegistry();
  return {};
};

export const readMirroredAssetUrl = (contentHash: string): string | undefined =>
  readAssetRegistry()[contentHash];

/**
 * Records the URL of this graph's copy of an asset, creating the registry page and
 * block if they are absent.
 *
 * Read-modify-write, deliberately not serialized. Two overlapping writes (two tabs on
 * the same graph, or a future caller that stops awaiting each asset) keep only the last
 * entry, costing one redundant upload on the next import, which ENG-2216 priced in. The
 * merge guarantees something narrower: sibling keys under `DISCOURSE_GRAPH_PROP_NAME`
 * survive, because the props are re-read here rather than replaced wholesale.
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
