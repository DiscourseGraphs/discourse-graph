import type { McpBridgeWriteStore } from "./mcpBridgeWriteStore.js";
import type {
  McpBridgeClearWriteResponse,
  McpBridgePendingWriteBatch,
  McpBridgePendingWriteResponse,
  McpBridgeProposeWriteResponse,
  McpBridgeWriteBatchStatus,
  McpBridgeWriteOperation,
} from "./mcpBridgeWrite.types.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseCreateNodeOperation = (
  value: Record<string, unknown>,
): McpBridgeWriteOperation | null => {
  if (
    value.kind !== "create_node" ||
    typeof value.nodeTypeId !== "string" ||
    typeof value.content !== "string" ||
    value.content.trim() === ""
  ) {
    return null;
  }

  return {
    kind: "create_node",
    nodeTypeId: value.nodeTypeId,
    content: value.content,
    body: typeof value.body === "string" ? value.body : undefined,
  };
};

const parseUpdateNodeOperation = (
  value: Record<string, unknown>,
): McpBridgeWriteOperation | null => {
  if (value.kind !== "update_node") {
    return null;
  }

  const nodeInstanceId =
    typeof value.nodeInstanceId === "string"
      ? value.nodeInstanceId
      : typeof value.nodeId === "string"
        ? value.nodeId
        : undefined;
  const filename =
    typeof value.filename === "string"
      ? value.filename
      : typeof value.path === "string"
        ? value.path
        : undefined;

  if (!nodeInstanceId && !filename) {
    return null;
  }

  const title = typeof value.title === "string" ? value.title : undefined;
  const content =
    typeof value.content === "string"
      ? value.content
      : typeof value.body === "string"
        ? value.body
        : undefined;

  if (title === undefined && content === undefined) {
    return null;
  }

  return {
    kind: "update_node",
    ...(nodeInstanceId ? { nodeInstanceId } : {}),
    ...(filename ? { filename } : {}),
    title,
    content,
  };
};

const parseCreateRelationOperation = (
  value: Record<string, unknown>,
): McpBridgeWriteOperation | null => {
  if (
    value.kind !== "create_relation" ||
    typeof value.sourceId !== "string" ||
    typeof value.destinationId !== "string" ||
    typeof value.relationTypeId !== "string"
  ) {
    return null;
  }

  return {
    kind: "create_relation",
    sourceId: value.sourceId,
    destinationId: value.destinationId,
    relationTypeId: value.relationTypeId,
  };
};

const parseWriteOperation = (value: unknown): McpBridgeWriteOperation | null => {
  if (!isRecord(value)) {
    return null;
  }

  switch (value.kind) {
    case "create_node":
      return parseCreateNodeOperation(value);
    case "update_node":
      return parseUpdateNodeOperation(value);
    case "create_relation":
      return parseCreateRelationOperation(value);
    default:
      return null;
  }
};

export const parseProposeWriteBody = (
  body: Record<string, unknown> | null,
): { operations: McpBridgeWriteOperation[]; label?: string } | null => {
  if (!body || !Array.isArray(body.operations) || body.operations.length === 0) {
    return null;
  }

  const operations: McpBridgeWriteOperation[] = [];
  for (const operation of body.operations) {
    const parsed = parseWriteOperation(operation);
    if (!parsed) {
      return null;
    }
    operations.push(parsed);
  }

  return {
    operations,
    label: typeof body.label === "string" ? body.label : undefined,
  };
};

export const parseClearWriteBody = (
  body: Record<string, unknown> | null,
): Extract<McpBridgeWriteBatchStatus, "approved" | "rejected"> | undefined => {
  if (!body) {
    return undefined;
  }
  if (body.resolution === "approved" || body.resolution === "rejected") {
    return body.resolution;
  }
  return undefined;
};

export type McpBridgeWriteApi = {
  proposeWrite: (input: {
    operations: McpBridgeWriteOperation[];
    label?: string;
  }) => McpBridgeProposeWriteResponse;
  getPendingWrite: (batchId: string) => McpBridgePendingWriteResponse;
  listPendingWrites: () => McpBridgePendingWriteBatch[];
  clearWrite: (
    batchId: string,
    resolution?: Extract<McpBridgeWriteBatchStatus, "approved" | "rejected">,
  ) => McpBridgeClearWriteResponse;
  pendingCount: () => number;
};

export const createMcpBridgeWriteApi = (
  store: McpBridgeWriteStore,
): McpBridgeWriteApi => ({
  proposeWrite: ({ operations, label }) => {
    const batch = store.propose({ operations, label });
    return {
      ok: true,
      batchId: batch.batchId,
      status: "pending",
      createdAt: batch.createdAt,
      expiresAt: batch.expiresAt,
      operationCount: batch.operations.length,
    };
  },

  getPendingWrite: (batchId) => ({
    batch: store.getBatch(batchId),
  }),

  listPendingWrites: () => store.listPending(),

  clearWrite: (batchId, resolution) => {
    const cleared = store.clear(batchId, resolution);
    if (!cleared) {
      return {
        cleared: false,
        batch: null,
        error: `No write batch matched batchId ${batchId}.`,
      };
    }

    return {
      cleared: true,
      batch: cleared,
    };
  },

  pendingCount: () => store.pendingCount(),
});
