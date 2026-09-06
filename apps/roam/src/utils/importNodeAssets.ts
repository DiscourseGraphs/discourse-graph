import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { SharedNode } from "@repo/database/lib/sharedNodes";
import { getErrorMessage } from "./getErrorMessage";
import { mirrorAssetToRoamStorage } from "./mirrorAssetToRoamStorage";
import {
  collectAssetTokens,
  lookupCandidates,
  rewriteAssetLinks,
  type ResolvedAsset,
} from "./rewriteAssetLinks";

/**
 * The asset stage of materialization: copy the bytes an imported node references into
 * this graph's storage, and point the node's markdown at those copies.
 *
 * It runs between fetching the content and replacing the page's blocks, because the
 * markdown it returns is what gets written. Nothing here can fail the node: an asset that
 * cannot be copied leaves its token exactly as published, and is reported instead of
 * thrown.
 *
 * What that token then does depends on where it came from, and only one case is benign. A
 * Roam-origin token is a public Firebase URL, so the block still renders the asset from
 * the origin graph's storage. An Obsidian-origin token is a vault path this graph cannot
 * resolve; left verbatim, `![[attachments/diagram.png]]` is a page reference to Roam, so
 * a failed Obsidian asset leaves a link to an empty page named after a vault path.
 * Rewriting it to something inert would be the fix, and it is not this stage's to make:
 * the contract requires an unresolved token to survive unchanged, which is what lets a
 * later re-import resolve it once the bytes are there.
 */

export type SkippedImport = {
  sourceRef: string;
  reason: "too-large";
  size: number;
  limit: number;
};

export type FailedImport = {
  sourceRef: string;
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
 * A fresh report per call, never a shared constant. Callers own what they are handed and
 * the arrays are mutable, so one `report.failed.push(...)` on a returned object would
 * otherwise attribute one node's failure to every asset-free node in the session.
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

/**
 * The references recorded against the published node, which are the only things this
 * stage resolves. A node with no rows has no assets to copy, whether because it
 * references none or because none could be stored when it was published.
 */
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
    // Ordered so a repeated import does the same thing twice. Where two references share
    // a hash, the first one mirrored decides the uploaded file's extension, because the
    // second reuses its URL; without an order, which name that is comes down to whatever
    // Postgres returned first.
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
    // The node still imports, with every asset token left as published. Reported as one
    // failure rather than none, because "no rows" and "could not read the rows" produce
    // the same content and must not look the same to a reader.
    return {
      markdown,
      report: {
        ...emptyReport(),
        failed: [
          {
            sourceRef: sharedNode.rid,
            message: `Could not read the asset references of "${sharedNode.title}": ${getErrorMessage(error)}`,
          },
        ],
      },
    };
  }
  if (!references.length) return { markdown, report: emptyReport() };

  // Only the references this content actually makes. A row can outlive its token two
  // ways: `publishNodeAssets` cleans stale rows best-effort and logs rather than fails, and
  // the markdown fetched here has had its frontmatter or title heading stripped, so an
  // asset referenced only there has a row and no token. Copying one would spend the user's
  // storage, permanently, on bytes no block will ever point at.
  //
  // The set comes from the rewriter's own reading of the text, not from re-deriving the
  // spellings a path might take. Generating them forward cannot work: a note writes
  // `fig#1.png` as `fig%231.png`, and `encodeURI` leaves `#` and `?` alone, so a filter
  // built that way drops an asset the rewrite would have resolved.
  const resolvable = new Set(
    collectAssetTokens(markdown).flatMap(lookupCandidates),
  );
  const referenced = references.filter(({ filepath }) =>
    resolvable.has(filepath),
  );
  if (!referenced.length) return { markdown, report: emptyReport() };

  const resolved: ResolvedAsset[] = [];
  const report = emptyReport();
  /**
   * Counts are per distinct blob, not per reference. Two tokens for identical bytes are
   * one upload, and reporting the second as `reused` would tell a user on a first-ever
   * import that this graph already held something it had just fetched.
   */
  const handledHashes = new Set<string>();

  // Sequential on purpose. Two references to identical content share a hash, and the
  // registry is what stops the second one uploading again; running them together would
  // race that check and mirror the same bytes twice.
  for (const reference of referenced) {
    try {
      const result = await mirrorAssetToRoamStorage({
        client,
        contentHash: reference.filehash,
        sourcePath: reference.source_path,
      });
      if (result.status === "skipped") {
        report.skipped.push({
          sourceRef: reference.filepath,
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
        sourceRef: reference.filepath,
        url: result.url,
        sourcePath: reference.source_path,
      });
    } catch (error) {
      report.failed.push({
        sourceRef: reference.filepath,
        message: getErrorMessage(error),
      });
    }
  }

  return {
    markdown: rewriteAssetLinks({ markdown, assets: resolved }),
    report,
  };
};
