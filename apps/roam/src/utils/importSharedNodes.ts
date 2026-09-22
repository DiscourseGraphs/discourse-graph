import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { SharedNode } from "@repo/database/lib/sharedNodes";
import { orderConceptsByDependency } from "./conceptConversion";
import { sharedReferenceRid } from "./findTargetUid";
import { getErrorMessage } from "./getErrorMessage";
import { materializeSharedNode } from "./materializeSharedNode";
import { resolveSharedNodeTypes } from "./resolveSharedNodeTypes";
import { SOURCE_SLOT } from "./sourceSlot";

export type FailedSharedNodeImport = {
  sharedNode: SharedNode;
  status: "failed";
  message: string;
};

export type SharedNodeImportItem =
  | { sharedNode: SharedNode; status: "imported" | "skipped"; warning?: string }
  | FailedSharedNodeImport;

export const isFailedSharedNodeImport = (
  item: SharedNodeImportItem,
): item is FailedSharedNodeImport => item.status === "failed";

// Normalize references to RIDs before reusing the publish/sync dependency sorter:
// bare IDs from different spaces must not collide in a shared-node batch.
const orderSourcesFirst = (sharedNodes: SharedNode[]): SharedNode[] => {
  const nodesByRid = new Map(sharedNodes.map((node) => [node.rid, node]));
  const { ordered } = orderConceptsByDependency(
    sharedNodes.map((node) => {
      const source = node.slots?.[SOURCE_SLOT];
      return {
        source_local_id: node.rid,
        ...(source
          ? {
              local_reference_content: {
                [SOURCE_SLOT]: sharedReferenceRid(source, node.spaceUri),
              },
            }
          : {}),
      };
    }),
  );
  return ordered.map((concept) => nodesByRid.get(concept.source_local_id!)!);
};

export const importSharedNodes = async ({
  client,
  sharedNodes,
  onProgress,
}: {
  client: DGSupabaseClient;
  sharedNodes: SharedNode[];
  onProgress: (current: number, total: number) => void;
}): Promise<SharedNodeImportItem[]> => {
  const nodeTypesBySchemaId = await resolveSharedNodeTypes({
    client,
    sharedNodes,
  });
  const items: SharedNodeImportItem[] = [];
  for (const sharedNode of orderSourcesFirst(sharedNodes)) {
    try {
      const result = await materializeSharedNode({
        client,
        sharedNode,
        nodeType: nodeTypesBySchemaId.get(sharedNode.schemaId),
      });
      items.push(
        result.success
          ? {
              sharedNode,
              status: result.action === "skipped" ? "skipped" : "imported",
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
    onProgress(items.length, sharedNodes.length);
  }
  return items;
};
