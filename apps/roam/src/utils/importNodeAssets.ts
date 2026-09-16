import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { SharedNode } from "@repo/database/lib/sharedNodes";
import { getErrorMessage } from "./getErrorMessage";
import { mirrorAssetToRoamStorage } from "./mirrorAssetToRoamStorage";
import {
  collectAssetLocators,
  lookupCandidates,
  rewriteAssetLinks,
  type ResolvedAsset,
} from "./rewriteAssetLinks";

export type SkippedImport = {
  sourceLocator: string;
  reason: "too-large";
  size: number;
  limit: number;
};

export type FailedImport = {
  /** Absent when the failure was not about one asset. */
  sourceLocator?: string;
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
 * Nothing here fails the node: an asset that cannot be copied is reported and its locator
 * left exactly as published, so a later re-import can still resolve it. A surviving
 * Roam-origin locator keeps rendering from the origin graph; a surviving Obsidian one is a
 * vault path, which Roam reads as a reference to an empty page.
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

  let references: ReferenceRow[];
  try {
    references = await fetchNodeReferences({ client, sharedNode });
  } catch (error) {
    // Reported rather than swallowed: "no rows" and "could not read the rows" produce the
    // same content, so only the report tells them apart.
    return {
      markdown,
      report: {
        ...emptyReport(),
        failed: [
          {
            message: `Could not read the asset references of "${sharedNode.title}": ${getErrorMessage(error)}`,
          },
        ],
      },
    };
  }
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
   * `mirrored` and `reused` count distinct blobs: two locators for identical bytes are one
   * upload, and counting the second as `reused` would claim this graph already held what
   * it had just fetched. `skipped` and `failed` stay per locator, since each is a place
   * the page degraded.
   */
  const handledHashes = new Set<string>();
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
      if (!handledHashes.has(reference.filehash)) {
        handledHashes.add(reference.filehash);
        if (result.status === "mirrored") report.mirrored += 1;
        else report.reused += 1;
      }
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

  return {
    markdown: rewriteAssetLinks({ markdown, assets: resolved }),
    report,
  };
};
