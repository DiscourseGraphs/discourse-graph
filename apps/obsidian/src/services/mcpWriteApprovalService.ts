import { Notice } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type { McpBridgeWriteApi } from "./mcpBridgeWrite.js";
import { describeWriteOperation } from "./mcpBridgeWrite.types.js";
import type { McpBridgePendingWriteBatch } from "./mcpBridgeWrite.types.js";
import { executeWriteBatch } from "./mcpBridgeWriteExecutor.js";

const POLL_MS = 1200;
const PILL_ID = "dg-mcp-write-pill";
const PANEL_ID = "dg-mcp-write-panel";

export type McpWriteApprovalService = {
  start: () => void;
  stop: () => void;
  refresh: () => void;
  approveBatch: (batchId: string) => Promise<void>;
  rejectBatch: (batchId: string) => Promise<void>;
  getState: () => {
    pendingCount: number;
    pendingWrites: McpBridgePendingWriteBatch[];
    committingBatchIds: string[];
  };
};

export const createMcpWriteApprovalService = ({
  plugin,
  writeApi,
}: {
  plugin: DiscourseGraphPlugin;
  writeApi: McpBridgeWriteApi;
}): McpWriteApprovalService => {
  let pollTimer: number | null = null;
  let pollInFlight = false;
  let panelOpen = false;
  const committingBatchIds = new Set<string>();

  const getMountRoot = (): HTMLElement => activeDocument.body;

  const removeElement = (id: string): void => {
    getMountRoot().querySelector(`#${id}`)?.remove();
  };

  const renderPill = (batches: McpBridgePendingWriteBatch[]): void => {
    let pill = getMountRoot().querySelector<HTMLButtonElement>(`#${PILL_ID}`);
    if (!pill) {
      pill = activeDocument.createElement("button");
      pill.id = PILL_ID;
      pill.type = "button";
      pill.className = "dg-mcp-write-pill";
      pill.addEventListener("click", () => {
        panelOpen = !panelOpen;
        render();
      });
      getMountRoot().appendChild(pill);
    }

    const count = batches.length;
    pill.hidden = count === 0 && !panelOpen;
    pill.textContent =
      count === 0
        ? "MCP writes"
        : count === 1
          ? "1 MCP write pending"
          : `${count} MCP writes pending`;
    pill.setAttribute("aria-expanded", panelOpen ? "true" : "false");
  };

  const renderPanel = (batches: McpBridgePendingWriteBatch[]): void => {
    removeElement(PANEL_ID);
    if (!panelOpen) {
      return;
    }

    const panel = activeDocument.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "dg-mcp-write-panel";

    const header = activeDocument.createElement("div");
    header.className = "dg-mcp-write-panel__header";
    header.textContent = "Pending MCP writes";
    panel.appendChild(header);

    if (batches.length === 0) {
      const empty = activeDocument.createElement("p");
      empty.className = "dg-mcp-write-panel__empty";
      empty.textContent = "No pending writes.";
      panel.appendChild(empty);
    }

    for (const batch of batches) {
      const card = activeDocument.createElement("div");
      card.className = "dg-mcp-write-batch";
      card.dataset.batchId = batch.batchId;

      const title = activeDocument.createElement("div");
      title.className = "dg-mcp-write-batch__title";
      title.textContent = batch.label ?? `Batch ${batch.batchId.slice(0, 8)}`;
      card.appendChild(title);

      const list = activeDocument.createElement("ul");
      list.className = "dg-mcp-write-batch__operations";
      for (const operation of batch.operations) {
        const item = activeDocument.createElement("li");
        item.textContent = describeWriteOperation(operation, {
          nodeTypes: plugin.settings.nodeTypes,
          relationTypes: plugin.settings.relationTypes,
        });
        list.appendChild(item);
      }
      card.appendChild(list);

      const actions = activeDocument.createElement("div");
      actions.className = "dg-mcp-write-batch__actions";

      const approveButton = activeDocument.createElement("button");
      approveButton.type = "button";
      approveButton.className = "dg-mcp-write-btn dg-mcp-write-btn--approve";
      approveButton.textContent = "Approve";
      approveButton.disabled = committingBatchIds.has(batch.batchId);
      approveButton.addEventListener("click", () => {
        void approveBatch(batch.batchId);
      });

      const rejectButton = activeDocument.createElement("button");
      rejectButton.type = "button";
      rejectButton.className = "dg-mcp-write-btn dg-mcp-write-btn--reject";
      rejectButton.textContent = "Reject";
      rejectButton.disabled = committingBatchIds.has(batch.batchId);
      rejectButton.addEventListener("click", () => {
        void rejectBatch(batch.batchId);
      });

      actions.appendChild(approveButton);
      actions.appendChild(rejectButton);
      card.appendChild(actions);
      panel.appendChild(card);
    }

    getMountRoot().appendChild(panel);
  };

  const render = (): void => {
    const batches = writeApi.listPendingWrites();
    renderPill(batches);
    renderPanel(batches);
  };

  const approveBatch = async (batchId: string): Promise<void> => {
    if (committingBatchIds.has(batchId)) {
      return;
    }

    const response = writeApi.getPendingWrite(batchId);
    const batch = response.batch;
    if (!batch || batch.status !== "pending") {
      return;
    }

    committingBatchIds.add(batchId);
    render();

    try {
      const result = await executeWriteBatch(plugin, batch.operations);
      if (!result.ok) {
        new Notice(`MCP write failed: ${result.error}`, 6000);
        return;
      }

      writeApi.clearWrite(batchId, "approved");
      new Notice("MCP write approved.", 4000);
    } catch (error) {
      console.error("[dg-mcp-bridge] Failed to approve write batch:", error);
      new Notice(
        `MCP write failed: ${error instanceof Error ? error.message : String(error)}`,
        6000,
      );
    } finally {
      committingBatchIds.delete(batchId);
      render();
    }
  };

  const rejectBatch = async (batchId: string): Promise<void> => {
    if (committingBatchIds.has(batchId)) {
      return;
    }

    writeApi.clearWrite(batchId, "rejected");
    new Notice("MCP write rejected.", 3000);
    render();
  };

  const poll = (): void => {
    if (pollInFlight || committingBatchIds.size > 0) {
      return;
    }

    pollInFlight = true;
    try {
      render();
    } finally {
      pollInFlight = false;
    }
  };

  return {
    start: () => {
      if (pollTimer !== null) {
        return;
      }
      render();
      pollTimer = window.setInterval(poll, POLL_MS);
    },

    stop: () => {
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
      panelOpen = false;
      removeElement(PILL_ID);
      removeElement(PANEL_ID);
    },

    refresh: () => {
      render();
    },

    approveBatch,
    rejectBatch,

    getState: () => ({
      pendingCount: writeApi.pendingCount(),
      pendingWrites: writeApi.listPendingWrites(),
      committingBatchIds: Array.from(committingBatchIds),
    }),
  };
};
