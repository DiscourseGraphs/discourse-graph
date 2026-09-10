import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { SharedNode } from "@repo/database/lib/sharedNodes";
import { getErrorMessage } from "./getErrorMessage";
import { materializeSharedNode } from "./materializeSharedNode";
import { resolveSharedNodeTypes } from "./resolveSharedNodeTypes";

export type FailedSharedNodeImport = {
  sharedNode: SharedNode;
  status: "failed";
  message: string;
};

export type SharedNodeImportItem =
  | { sharedNode: SharedNode; status: "imported" | "skipped" }
  | FailedSharedNodeImport;

export const isFailedSharedNodeImport = (
  item: SharedNodeImportItem,
): item is FailedSharedNodeImport => item.status === "failed";

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
  for (const sharedNode of sharedNodes) {
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
