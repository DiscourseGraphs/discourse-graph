import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { SharedNode } from "@repo/database/lib/sharedNodes";
import { mirrorAssetToRoamStorage } from "./mirrorAssetToRoamStorage";
import { rewriteAssetLinks, type ResolvedAsset } from "./rewriteAssetLinks";

/**
 * The asset stage of materialization: copy the bytes an imported node references into
 * this graph's storage, and point the node's markdown at those copies.
 *
 * It runs between fetching the content and replacing the page's blocks, because the
 * markdown it returns is what gets written. Nothing here can fail the node. An asset that
 * cannot be copied leaves its token exactly as published, which still renders wherever
 * the publishing platform's URL was public, and is reported instead of thrown.
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

const EMPTY_REPORT: AssetImportReport = {
  mirrored: 0,
  reused: 0,
  skipped: [],
  failed: [],
};

/**
 * Supabase reports a failed query as a plain object carrying `message`, not as an
 * `Error`, so a message is read from either shape. Stringifying the object instead would
 * put `[object Object]` in front of the one person who needs to know what went wrong.
 */
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error;
    if (typeof message === "string") return message;
  }
  return String(error);
};

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
    .eq("source_local_id", sharedNode.sourceLocalId);
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
  if (!markdown) return { markdown, report: EMPTY_REPORT };

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
        ...EMPTY_REPORT,
        failed: [
          {
            sourceRef: sharedNode.rid,
            message: `Could not read the asset references of "${sharedNode.title}": ${getErrorMessage(error)}`,
          },
        ],
      },
    };
  }
  if (!references.length) return { markdown, report: EMPTY_REPORT };

  const resolved: ResolvedAsset[] = [];
  const report: AssetImportReport = {
    mirrored: 0,
    reused: 0,
    skipped: [],
    failed: [],
  };

  // Sequential on purpose. Two references to identical content share a hash, and the
  // registry is what stops the second one uploading again; running them together would
  // race that check and mirror the same bytes twice.
  for (const reference of references) {
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
      if (result.status === "mirrored") report.mirrored += 1;
      else report.reused += 1;
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
