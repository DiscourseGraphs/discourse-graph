import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { handleMcpBridgeHttpRequest } from "../src/services/mcpBridgeHttp.js";
import type { McpBridgeReadApi } from "../src/services/mcpBridgeRead.js";
import { createMcpBridgeWriteApi, parseProposeWriteBody } from "../src/services/mcpBridgeWrite.js";
import { createMcpBridgeWriteStore } from "../src/services/mcpBridgeWriteStore.js";
import {
  MCP_BRIDGE_PROPOSE_WRITE_PATH,
  type McpBridgeWriteOperation,
} from "../src/services/mcpBridgeWrite.types.js";
import {
  MCP_BRIDGE_HEALTH_PATH,
  buildMcpBridgeHealth,
  DEFAULT_MCP_BRIDGE_PORT,
  type McpBridgeHealth,
} from "../src/services/mcpBridge.types.js";

const sampleOperation: McpBridgeWriteOperation = {
  kind: "create_node",
  nodeTypeId: "claim",
  content: "What is MCP?",
  body: "Draft body",
};

const createHandlerFixture = () => {
  const writeStore = createMcpBridgeWriteStore();
  const write = createMcpBridgeWriteApi(writeStore);
  const health: McpBridgeHealth = buildMcpBridgeHealth({
    port: DEFAULT_MCP_BRIDGE_PORT,
    vaultId: "vault-test-id",
    vaultName: "Test Vault",
  });

  const read: McpBridgeReadApi = {
    getNodeTypes: () => [],
    getRelationTypes: () => [],
    getDiscourseRelations: () => [],
    searchNodes: async () => ({ nodes: [] }),
    getNode: async () => null,
    getNodeRelations: async () => [],
    getNodeContext: async () => null,
  };

  return {
    getHealth: () => health,
    getContext: async () => ({
      platform: "Obsidian" as const,
      vaultId: "vault-test-id",
      vaultName: "Test Vault",
      syncEnabled: false,
    }),
    read,
    write,
  };
};

const listenOnRandomPort = async (
  handler: ReturnType<typeof createHandlerFixture>,
): Promise<{ server: Server; baseUrl: string }> =>
  new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      void handleMcpBridgeHttpRequest(request, response, handler);
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      if (typeof address !== "object" || !address?.port) {
        reject(new Error("Server did not receive a TCP port."));
        return;
      }
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });

const closeServer = async (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

test("write store propose -> pending; clear -> gone", () => {
  const store = createMcpBridgeWriteStore();
  const batch = store.propose({ operations: [sampleOperation] });

  assert.equal(batch.status, "pending");
  assert.equal(store.pendingCount(), 1);
  assert.equal(store.getBatch(batch.batchId)?.status, "pending");

  const cleared = store.clear(batch.batchId, "rejected");
  assert.equal(cleared?.status, "rejected");
  assert.equal(store.pendingCount(), 0);
  assert.equal(store.getBatch(batch.batchId)?.status, "rejected");
});

test("write store expires pending batches after TTL", () => {
  let current = 0;
  const store = createMcpBridgeWriteStore({
    ttlMs: 1_000,
    now: () => current,
  });

  const batch = store.propose({ operations: [sampleOperation] });
  assert.equal(store.pendingCount(), 1);

  current = 2_000;
  assert.equal(store.getBatch(batch.batchId), null);
  assert.equal(store.pendingCount(), 0);
});

test("POST /propose-write returns batchId and pending status", async (t) => {
  const handler = createHandlerFixture();
  const { server, baseUrl } = await listenOnRandomPort(handler);
  t.after(() => closeServer(server));

  const response = await fetch(`${baseUrl}${MCP_BRIDGE_PROPOSE_WRITE_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      label: "create-question",
      operations: [sampleOperation],
    }),
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    ok: true;
    batchId: string;
    status: string;
    operationCount: number;
  };
  assert.equal(body.ok, true);
  assert.equal(body.status, "pending");
  assert.equal(body.operationCount, 1);
  assert.equal(typeof body.batchId, "string");
});

test("GET /pending-write/:id returns pending batch", async (t) => {
  const handler = createHandlerFixture();
  const proposed = handler.write.proposeWrite({ operations: [sampleOperation] });
  const { server, baseUrl } = await listenOnRandomPort(handler);
  t.after(() => closeServer(server));

  const response = await fetch(
    `${baseUrl}/pending-write/${proposed.batchId}`,
  );
  const body = (await response.json()) as {
    batch: { status: string; operations: McpBridgeWriteOperation[] };
  };

  assert.equal(body.batch.status, "pending");
  assert.equal(body.batch.operations[0]?.kind, "create_node");
});

test("POST /clear-write/:id removes pending batch", async (t) => {
  const handler = createHandlerFixture();
  const proposed = handler.write.proposeWrite({ operations: [sampleOperation] });
  const { server, baseUrl } = await listenOnRandomPort(handler);
  t.after(() => closeServer(server));

  const clearResponse = await fetch(
    `${baseUrl}/clear-write/${proposed.batchId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution: "rejected" }),
    },
  );
  assert.equal(clearResponse.status, 200);

  const pendingResponse = await fetch(
    `${baseUrl}/pending-write/${proposed.batchId}`,
  );
  const pendingBody = (await pendingResponse.json()) as {
    batch: { status: string };
  };
  assert.equal(pendingBody.batch.status, "rejected");
  assert.equal(handler.write.pendingCount(), 0);
});

test("parseProposeWriteBody accepts update_node by filename with title and content", () => {
  const parsed = parseProposeWriteBody({
    operations: [
      {
        kind: "update_node",
        filename: "Discourse Nodes/CLM - Example.md",
        title: "Revised claim text",
        content: "Updated body",
      },
    ],
  });

  assert.ok(parsed);
  const operation = parsed.operations[0];
  assert.equal(operation?.kind, "update_node");
  if (operation?.kind !== "update_node") {
    return;
  }
  assert.equal(operation.filename, "Discourse Nodes/CLM - Example.md");
  assert.equal(operation.title, "Revised claim text");
  assert.equal(operation.content, "Updated body");
});

test("parseProposeWriteBody accepts update_node by nodeInstanceId with title only", () => {
  const parsed = parseProposeWriteBody({
    operations: [
      {
        kind: "update_node",
        nodeInstanceId: "019e65a7-c7cb-70a5-87e1-340f2d6b9a70",
        title: "New question wording",
      },
    ],
  });

  assert.ok(parsed);
  const operation = parsed.operations[0];
  assert.equal(operation?.kind, "update_node");
  if (operation?.kind !== "update_node") {
    return;
  }
  assert.equal(operation.nodeInstanceId, "019e65a7-c7cb-70a5-87e1-340f2d6b9a70");
  assert.equal(operation.title, "New question wording");
  assert.equal(operation.content, undefined);
});

test("parseProposeWriteBody rejects update_node without target or fields", () => {
  assert.equal(
    parseProposeWriteBody({
      operations: [{ kind: "update_node", title: "Only title" }],
    }),
    null,
  );
  assert.equal(
    parseProposeWriteBody({
      operations: [
        { kind: "update_node", nodeInstanceId: "node-1" },
      ],
    }),
    null,
  );
});

test("POST /propose-write rejects invalid payload", async (t) => {
  const handler = createHandlerFixture();
  const { server, baseUrl } = await listenOnRandomPort(handler);
  t.after(() => closeServer(server));

  const response = await fetch(`${baseUrl}${MCP_BRIDGE_PROPOSE_WRITE_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operations: [] }),
  });

  assert.equal(response.status, 400);
});
