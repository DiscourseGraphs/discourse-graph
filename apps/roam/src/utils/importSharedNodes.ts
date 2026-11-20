import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { LocalConceptDataInput } from "@repo/database/inputTypes";
import type { DbCrossAppNode } from "@repo/database/lib/dbToCrossAppConverters";
import { ridToSpaceUriAndLocalId } from "@repo/database/lib/rid";
import {
  getNodeTypeRid,
  getSharedNodeSpace,
  type SharedNodeListing,
} from "@repo/database/lib/sharedNodes";
import { orderConceptsByDependency } from "./conceptConversion";
import { sharedReferenceRid } from "./findTargetUid";
import { getErrorMessage } from "./getErrorMessage";
import { findImportedNodeUidBySourceRid } from "./importedSourceIdentity";
import { materializeSharedNode } from "./materializeSharedNode";
import { resolveSharedNodeTypes } from "./resolveSharedNodeTypes";
import { SOURCE_SLOT } from "./sourceSlot";

export type FailedSharedNodeImport = {
  sharedNode: DbCrossAppNode;
  status: "failed";
  message: string;
};

export type SharedNodeImportItem =
  | {
      sharedNode: DbCrossAppNode;
      status: "imported" | "skipped";
      pageUid: string;
      warning?: string;
    }
  | FailedSharedNodeImport;

export const isFailedSharedNodeImport = (
  item: SharedNodeImportItem,
): item is FailedSharedNodeImport => item.status === "failed";

// Normalize references to RIDs before reusing the publish/sync dependency sorter:
// bare IDs from different spaces must not collide in a shared-node batch.
const asConcept = (node: DbCrossAppNode): LocalConceptDataInput => {
  const source = node.slots?.[SOURCE_SLOT];
  return {
    source_local_id: node.rid,
    ...(source
      ? {
          local_reference_content: {
            [SOURCE_SLOT]: sharedReferenceRid(
              source,
              ridToSpaceUriAndLocalId(node.rid).spaceUri,
            ),
          },
        }
      : {}),
  };
};

const orderSourcesFirst = (sharedNodes: DbCrossAppNode[]): DbCrossAppNode[] => {
  const nodesByRid = new Map(sharedNodes.map((node) => [node.rid, node]));
  const { ordered } = orderConceptsByDependency(sharedNodes.map(asConcept));
  return ordered.map((concept) => nodesByRid.get(concept.source_local_id!)!);
};

const discoveredSourcesToImport = async ({
  sharedNodes,
  discoveredNodes,
}: {
  sharedNodes: DbCrossAppNode[];
  discoveredNodes: DbCrossAppNode[];
}): Promise<DbCrossAppNode[]> => {
  const { missing } = orderConceptsByDependency(sharedNodes.map(asConcept));
  const discoveredByRid = new Map(
    discoveredNodes.map((node) => [node.rid, node]),
  );
  const sources: DbCrossAppNode[] = [];
  for (const rid of missing) {
    const source = discoveredByRid.get(rid);
    if (!source) continue;
    const importedUid = await findImportedNodeUidBySourceRid(rid).catch(
      () => null,
    );
    if (!importedUid) sources.push(source);
  }
  return sources;
};

export const importSharedNodes = async ({
  client,
  sharedNodes,
  discoveredNodes,
  spaces,
  onProgress,
}: {
  client: DGSupabaseClient;
  sharedNodes: DbCrossAppNode[];
  discoveredNodes: DbCrossAppNode[];
  spaces: SharedNodeListing["spaces"];
  onProgress: (current: number, total: number) => void;
}): Promise<SharedNodeImportItem[]> => {
  const batch = [
    ...sharedNodes,
    ...(await discoveredSourcesToImport({ sharedNodes, discoveredNodes })),
  ];
  const nodeTypesBySchemaRid = await resolveSharedNodeTypes({
    client,
    sharedNodes: batch,
    spaces,
  });
  const items: SharedNodeImportItem[] = [];
  for (const sharedNode of orderSourcesFirst(batch)) {
    try {
      const result = await materializeSharedNode({
        client,
        sharedNode,
        space: getSharedNodeSpace({ node: sharedNode, spaces }),
        nodeType: nodeTypesBySchemaRid.get(getNodeTypeRid(sharedNode)),
      });
      items.push(
        result.success
          ? {
              sharedNode,
              status: result.action === "skipped" ? "skipped" : "imported",
              pageUid: result.pageUid,
              ...(result.warning ? { warning: result.warning } : {}),
            }
          : { sharedNode, status: "failed", message: result.error.message },
      );
    } catch (error) {
      items.push({
        sharedNode,
        status: "failed",
        message: getErrorMessage(error),
      });
    }
    onProgress(items.length, batch.length);
  }
  return items;
};
