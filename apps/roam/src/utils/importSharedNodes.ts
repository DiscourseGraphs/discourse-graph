import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { SharedNode } from "@repo/database/lib/sharedNodes";
import { sharedReferenceRid } from "./findTargetUid";
import {
  getErrorMessage,
  materializeSharedNode,
} from "./materializeSharedNode";
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

// A node's title can only name its source once that source has a local page, so the
// nodes other batch members refer to are materialized first.
const orderSourcesFirst = (sharedNodes: SharedNode[]): SharedNode[] => {
  const referencedRids = new Set(
    sharedNodes.flatMap((node) => {
      const source = node.slots?.[SOURCE_SLOT];
      return source ? [sharedReferenceRid(source, node.spaceUri)] : [];
    }),
  );
  return [
    ...sharedNodes.filter((node) => referencedRids.has(node.rid)),
    ...sharedNodes.filter((node) => !referencedRids.has(node.rid)),
  ];
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
