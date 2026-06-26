export const MCP_BRIDGE_PROPOSE_WRITE_PATH = "/propose-write";
export const MCP_BRIDGE_PENDING_WRITES_PATH = "/pending-writes";

export const DEFAULT_WRITE_BATCH_TTL_MS = 60 * 60 * 1000;

export type McpBridgeWriteOperation =
  | {
      kind: "create_node";
      nodeTypeId: string;
      content: string;
      body?: string;
    }
  | {
      kind: "update_node";
      /** Resolve target by frontmatter `nodeInstanceId`. */
      nodeInstanceId?: string;
      /** Resolve target by vault path or note basename (with or without `.md`). */
      filename?: string;
      /** New discourse title text (`{content}` slot); renames the note file. */
      title?: string;
      /** New markdown body for the note file. */
      content?: string;
    }
  | {
      kind: "create_relation";
      sourceId: string;
      destinationId: string;
      relationTypeId: string;
    };

export type McpBridgeWriteBatchStatus = "pending" | "approved" | "rejected";

export type McpBridgePendingWriteBatch = {
  batchId: string;
  status: "pending";
  createdAt: string;
  expiresAt: string;
  label?: string;
  operations: McpBridgeWriteOperation[];
};

export type McpBridgeResolvedWriteBatch = {
  batchId: string;
  status: "approved" | "rejected";
  createdAt: string;
  resolvedAt: string;
  label?: string;
  operations: McpBridgeWriteOperation[];
};

export type McpBridgeWriteBatch =
  | McpBridgePendingWriteBatch
  | McpBridgeResolvedWriteBatch;

export type McpBridgeProposeWriteResponse = {
  ok: true;
  batchId: string;
  status: "pending";
  createdAt: string;
  expiresAt: string;
  operationCount: number;
};

export type McpBridgePendingWriteResponse = {
  batch: McpBridgeWriteBatch | null;
};

export type McpBridgeClearWriteResponse = {
  cleared: boolean;
  batch: McpBridgeWriteBatch | null;
  error?: string;
};

export type WriteSchemaLabels = {
  nodeTypes?: Array<{ id: string; name: string }>;
  relationTypes?: Array<{ id: string; label: string }>;
};

export const describeWriteOperation = (
  operation: McpBridgeWriteOperation,
  schema: WriteSchemaLabels = {},
): string => {
  switch (operation.kind) {
    case "create_node": {
      const nodeType = schema.nodeTypes?.find(
        (type) => type.id === operation.nodeTypeId,
      );
      const bodySuffix = operation.body ? " (+ body)" : "";
      return `Create ${nodeType?.name ?? "node"}: ${operation.content}${bodySuffix}`;
    }
    case "update_node": {
      const target = operation.filename ?? operation.nodeInstanceId ?? "node";
      const parts: string[] = [`Update ${target}`];
      if (operation.title !== undefined) {
        parts.push(`title → ${operation.title}`);
      }
      if (operation.content !== undefined) {
        parts.push("body");
      }
      return parts.join(" · ");
    }
    case "create_relation": {
      const relationType = schema.relationTypes?.find(
        (type) => type.id === operation.relationTypeId,
      );
      return `Add ${relationType?.label ?? operation.relationTypeId}: ${operation.sourceId} → ${operation.destinationId}`;
    }
    default:
      return "Unknown operation";
  }
};
