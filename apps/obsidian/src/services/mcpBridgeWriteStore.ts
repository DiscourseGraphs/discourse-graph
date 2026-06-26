import {
  DEFAULT_WRITE_BATCH_TTL_MS,
  type McpBridgePendingWriteBatch,
  type McpBridgeResolvedWriteBatch,
  type McpBridgeWriteBatch,
  type McpBridgeWriteBatchStatus,
  type McpBridgeWriteOperation,
} from "./mcpBridgeWrite.types.js";

const MAX_RESOLUTIONS = 50;

export type McpBridgeWriteStore = {
  propose: (input: {
    operations: McpBridgeWriteOperation[];
    label?: string;
  }) => McpBridgePendingWriteBatch;
  getBatch: (batchId: string) => McpBridgeWriteBatch | null;
  listPending: () => McpBridgePendingWriteBatch[];
  clear: (
    batchId: string,
    resolution?: Extract<McpBridgeWriteBatchStatus, "approved" | "rejected">,
  ) => McpBridgeWriteBatch | null;
  pendingCount: () => number;
};

const createBatchId = (): string => crypto.randomUUID();

export const createMcpBridgeWriteStore = ({
  ttlMs = DEFAULT_WRITE_BATCH_TTL_MS,
  now = () => Date.now(),
}: {
  ttlMs?: number;
  now?: () => number;
} = {}): McpBridgeWriteStore => {
  const pendingBatches = new Map<string, McpBridgePendingWriteBatch>();
  const recentResolutions = new Map<string, McpBridgeResolvedWriteBatch>();

  const purgeExpired = (): void => {
    const currentTime = now();
    for (const [batchId, batch] of pendingBatches.entries()) {
      if (Date.parse(batch.expiresAt) <= currentTime) {
        pendingBatches.delete(batchId);
      }
    }
  };

  const recordResolution = (
    batch: McpBridgePendingWriteBatch,
    resolution: "approved" | "rejected",
  ): McpBridgeResolvedWriteBatch => {
    const resolved: McpBridgeResolvedWriteBatch = {
      batchId: batch.batchId,
      status: resolution,
      createdAt: batch.createdAt,
      resolvedAt: new Date(now()).toISOString(),
      label: batch.label,
      operations: batch.operations,
    };

    recentResolutions.set(batch.batchId, resolved);
    if (recentResolutions.size > MAX_RESOLUTIONS) {
      const oldest = recentResolutions.keys().next().value;
      if (oldest) {
        recentResolutions.delete(oldest);
      }
    }

    return resolved;
  };

  return {
    propose: ({ operations, label }) => {
      purgeExpired();
      const createdAt = new Date(now()).toISOString();
      const batch: McpBridgePendingWriteBatch = {
        batchId: createBatchId(),
        status: "pending",
        createdAt,
        expiresAt: new Date(now() + ttlMs).toISOString(),
        label,
        operations,
      };
      pendingBatches.set(batch.batchId, batch);
      return batch;
    },

    getBatch: (batchId) => {
      purgeExpired();
      const pending = pendingBatches.get(batchId);
      if (pending) {
        return pending;
      }
      return recentResolutions.get(batchId) ?? null;
    },

    listPending: () => {
      purgeExpired();
      return Array.from(pendingBatches.values());
    },

    clear: (batchId, resolution) => {
      purgeExpired();
      const pending = pendingBatches.get(batchId);
      if (!pending) {
        return recentResolutions.get(batchId) ?? null;
      }

      pendingBatches.delete(batchId);
      if (resolution) {
        return recordResolution(pending, resolution);
      }

      return {
        batchId: pending.batchId,
        status: "rejected",
        createdAt: pending.createdAt,
        resolvedAt: new Date(now()).toISOString(),
        label: pending.label,
        operations: pending.operations,
      };
    },

    pendingCount: () => {
      purgeExpired();
      return pendingBatches.size;
    },
  };
};
