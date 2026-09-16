import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { SharedNode } from "@repo/database/lib/sharedNodes";
import { getErrorMessage } from "./getErrorMessage";
import { mirrorAssetToRoamStorage } from "./mirrorAssetToRoamStorage";
import {
  collectAssetLocators,
  FAILED_IMPORT_MARKER,
  lookupCandidates,
  rewriteAssetLinks,
  TOO_LARGE_MARKER,
  type ResolvedAsset,
  type UnresolvedAsset,
} from "./rewriteAssetLinks";

export type SkippedImport = {
  sourceLocator: string;
  reason: "too-large";
  size: number;
  limit: number;
};

export type FailedImport = {
  sourceLocator: string;
  message: string;
};

export type AssetImportReport = {
  /** Uploaded into this graph's storage by this run. */
  mirrored: number;
  /** Already held by this graph, so no upload was needed. */
  reused: number;
  skipped: SkippedImport[];
  failed: FailedImport[];
};

/**
 * A fresh report per call, never a shared constant: the arrays are mutable, so a caller's
 * push would otherwise reach every other node's report.
 */
const emptyReport = (): AssetImportReport => ({
  mirrored: 0,
  reused: 0,
  skipped: [],
  failed: [],
});

type ReferenceRow = {
  filepath: string;
  filehash: string;
  source_path: string | null;
};

const fetchNodeReferences = async ({
  client,
  sharedNode,
}: {
  client: DGSupabaseClient;
  sharedNode: SharedNode;
}): Promise<ReferenceRow[]> => {
  const { data, error } = await client
    .from("my_file_references")
    .select("filepath, filehash, source_path")
    .eq("space_id", sharedNode.spaceId)
    .eq("source_local_id", sharedNode.sourceLocalId)
    // Ordered so a repeated import does the same thing twice: where two references share a
    // hash, whichever mirrors first decides the uploaded file's extension.
    .order("filepath");
  if (error) throw error;
  return (data ?? []).flatMap((row): ReferenceRow[] =>
    typeof row.filepath === "string" && typeof row.filehash === "string"
      ? [
          {
            filepath: row.filepath,
            filehash: row.filehash,
            source_path:
              typeof row.source_path === "string" ? row.source_path : null,
          },
        ]
      : [],
  );
};

/**
 * The asset stage of materialization: copy the bytes an imported node references into
 * this graph's storage, and point the node's markdown at those copies.
 *
 * An asset that cannot be copied does not fail the node: it is reported, and its link is
 * marked so the reader knows to refresh the page. Only a forced refresh retries it, since
 * the page is recorded as up to date.
 *
 * Failing to read the references throws, since no link can be marked without them. A
 * caller must then fail the node without recording its source timestamp, so the next
 * import retries it.
 */
export const importNodeAssets = async ({
  client,
  sharedNode,
  markdown,
}: {
  client: DGSupabaseClient;
  sharedNode: SharedNode;
  markdown: string;
}): Promise<{ markdown: string; report: AssetImportReport }> => {
  if (!markdown) return { markdown, report: emptyReport() };

  const references = await fetchNodeReferences({ client, sharedNode });
  if (!references.length) return { markdown, report: emptyReport() };

  // Locators come from the rewriter's own reading of the text. Re-deriving the spellings a
  // path might take cannot work: a note writes `fig#1.png` as `fig%231.png`, and
  // `encodeURI` leaves `#` alone, so such a filter drops assets the rewrite would resolve.
  const resolvable = new Set(
    collectAssetLocators(markdown).flatMap(lookupCandidates),
  );

  // Only the references this content makes, since a copy is permanent. A row outlives its
  // locator when `publishNodeAssets` fails to clean it up, or when the asset was
  // referenced only in the stripped frontmatter or title heading.
  const referenced = references.filter(({ filepath }) =>
    resolvable.has(filepath),
  );
  if (!referenced.length) return { markdown, report: emptyReport() };

  const resolved: ResolvedAsset[] = [];
  const report = emptyReport();
  /**
   * The copy each hash resolved to in this run. A second locator for identical bytes takes
   * the URL from here rather than from the registry, whose write is best-effort: when it
   * fails, asking again would upload the same bytes a second time, permanently.
   *
   * `mirrored` and `reused` therefore count distinct blobs, and counting the second locator
   * as `reused` would claim this graph already held what it had just fetched. `skipped` and
   * `failed` stay per locator, since each is a place the page degraded.
   */
  const urlByHash = new Map<string, string>();
  /**
   * Oversize is a property of the bytes, so it is decided once per hash: asking again
   * costs a round trip, or a second download of a blob already known to be too big. A
   * throw is not cached, since it may be transient.
   */
  const skippedByHash = new Map<string, { size: number; limit: number }>();

  // Sequential on purpose: the registry check that stops identical bytes uploading twice
  // races if these run together.
  for (const reference of referenced) {
    const alreadySkipped = skippedByHash.get(reference.filehash);
    if (alreadySkipped) {
      report.skipped.push({
        sourceLocator: reference.filepath,
        reason: "too-large",
        ...alreadySkipped,
      });
      continue;
    }
    const alreadyResolved = urlByHash.get(reference.filehash);
    if (alreadyResolved) {
      resolved.push({
        sourceLocator: reference.filepath,
        url: alreadyResolved,
        sourcePath: reference.source_path,
      });
      continue;
    }
    try {
      const result = await mirrorAssetToRoamStorage({
        client,
        contentHash: reference.filehash,
        sourcePath: reference.source_path,
      });
      if (result.status === "skipped") {
        skippedByHash.set(reference.filehash, {
          size: result.size,
          limit: result.limit,
        });
        report.skipped.push({
          sourceLocator: reference.filepath,
          reason: result.reason,
          size: result.size,
          limit: result.limit,
        });
        continue;
      }
      urlByHash.set(reference.filehash, result.url);
      if (result.status === "mirrored") report.mirrored += 1;
      else report.reused += 1;
      resolved.push({
        sourceLocator: reference.filepath,
        url: result.url,
        sourcePath: reference.source_path,
      });
    } catch (error) {
      report.failed.push({
        sourceLocator: reference.filepath,
        message: getErrorMessage(error),
      });
    }
  }

  const unresolved = [
    ...report.failed.map(
      ({ sourceLocator }): UnresolvedAsset => ({
        sourceLocator,
        marker: FAILED_IMPORT_MARKER,
      }),
    ),
    ...report.skipped.map(
      ({ sourceLocator }): UnresolvedAsset => ({
        sourceLocator,
        marker: TOO_LARGE_MARKER,
      }),
    ),
  ];

  return {
    markdown: rewriteAssetLinks({ markdown, assets: resolved, unresolved }),
    report,
  };
};
