import { DISCOURSE_GRAPH_PROP_NAME } from "./createReifiedBlock";
import getBlockProps, { isJsonObject } from "./getBlockProps";
import internalError from "./internalError";
import type { NodeAssetResult } from "./publishNodeAssets";
import { setBlockPropsAsync } from "./setBlockProps";

/**
 * Makes the next sync re-upload a node whose asset copy failed. Any block write moves the
 * page's `:page/edit-time`, which the sync compares against the start of its last
 * successful run. Retries are unbounded.
 *
 * A props write, not a string rewrite: rewriting the string reassigns `:edit/user` to
 * whoever runs the sync. That a props write leaves it alone is undocumented.
 */

/**
 * Written, never read, and never cleared: clearing it would re-upload the node once more.
 * Whether an asset reached storage is answered by its `FileReference` row.
 */
export const NEEDS_REFRESH_PROP_KEY = "needsRefresh";

/**
 * An asset that reaches the markdown through a block ref or an embed lives on another
 * page, where a write would not move this node's edit time. Those are not retried.
 */
const findBlocksReferencingAsset = async ({
  pageUid,
  assetUrl,
}: {
  pageUid: string;
  assetUrl: string;
}): Promise<string[]> =>
  (await window.roamAlphaAPI.data.async.q(
    `[:find [?uid ...]
      :in $ ?page-uid ?url
      :where
        [?page :block/uid ?page-uid]
        [?block :block/page ?page]
        [?block :block/string ?text]
        [(clojure.string/includes? ?text ?url)]
        [?block :block/uid ?uid]]`,
    pageUid,
    assetUrl,
  )) as unknown as string[];

/** `discourse-graph` may already hold other data, so the flag is merged into it. */
const markBlockForAssetRetry = async (blockUid: string): Promise<void> => {
  const existing = getBlockProps(blockUid)[DISCOURSE_GRAPH_PROP_NAME];
  const discourseGraphProps = isJsonObject(existing) ? existing : {};
  await setBlockPropsAsync(blockUid, {
    [DISCOURSE_GRAPH_PROP_NAME]: {
      ...discourseGraphProps,
      [NEEDS_REFRESH_PROP_KEY]: true,
    },
  });
};

/**
 * One write per node is enough: the re-upload retries every asset of the node, including
 * those with no block on the page. Returns the nodes marked.
 */
export const requestAssetRetries = async (
  results: NodeAssetResult[],
): Promise<Set<string>> => {
  const failedByNode = new Map<string, string[]>();
  for (const result of results) {
    if (result.status !== "failed") continue;
    const assetUrls = failedByNode.get(result.sourceLocalId) ?? [];
    assetUrls.push(result.sourceRef);
    failedByNode.set(result.sourceLocalId, assetUrls);
  }

  const retried = new Set<string>();
  for (const [pageUid, assetUrls] of failedByNode) {
    try {
      for (const assetUrl of assetUrls) {
        const [blockUid] = await findBlocksReferencingAsset({
          pageUid,
          assetUrl,
        });
        if (blockUid === undefined) continue;
        await markBlockForAssetRetry(blockUid);
        retried.add(pageUid);
        break;
      }
    } catch (error) {
      internalError({
        error,
        type: "Asset retry failed",
        context: { sourceLocalId: pageUid },
        sendEmail: false,
      });
    }
  }
  return retried;
};
