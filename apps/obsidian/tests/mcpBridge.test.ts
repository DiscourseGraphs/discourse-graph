import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { handleMcpBridgeHttpRequest } from "../src/services/mcpBridgeHttp.js";
import type { McpBridgeReadApi } from "../src/services/mcpBridgeRead.js";
import { createMcpBridgeWriteApi } from "../src/services/mcpBridgeWrite.js";
import { createMcpBridgeWriteStore } from "../src/services/mcpBridgeWriteStore.js";
import {
  MCP_BRIDGE_CONTEXT_PATH,
  MCP_BRIDGE_DISCOURSE_RELATIONS_PATH,
  MCP_BRIDGE_HEALTH_PATH,
  MCP_BRIDGE_NODE_TYPES_PATH,
  MCP_BRIDGE_RELATION_TYPES_PATH,
  MCP_BRIDGE_SEARCH_PATH,
  MCP_BRIDGE_SERVICE_NAME,
  buildMcpBridgeHealth,
  DEFAULT_MCP_BRIDGE_PORT,
  type McpBridgeContext,
  type McpBridgeHealth,
} from "../src/services/mcpBridge.types.js";

const listenOnRandomPort = async (
  handler: Parameters<typeof handleMcpBridgeHttpRequest>[2],
): Promise<{ server: Server; port: number; baseUrl: string }> =>
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
        port: address.port,
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

const healthFixture: McpBridgeHealth = buildMcpBridgeHealth({
  port: DEFAULT_MCP_BRIDGE_PORT,
  vaultId: "vault-test-id",
  vaultName: "Test Vault",
});

const contextFixture: McpBridgeContext = {
  platform: "Obsidian",
  vaultId: "vault-test-id",
  vaultName: "Test Vault",
  syncEnabled: true,
  spaceId: 7,
  spaceUrl: "obsidian:vault-test-id",
};

const readFixture: McpBridgeReadApi = {
  getNodeTypes: () => [
    { id: "claim", name: "Claim", format: "CLM - {content}" },
  ],
  getRelationTypes: () => [
    {
      id: "supports",
      label: "supports",
      complement: "is supported by",
      color: "green",
      created: 0,
      modified: 0,
    },
  ],
  getDiscourseRelations: () => [
    {
      id: "rel1",
      sourceId: "evidence",
      destinationId: "claim",
      relationshipTypeId: "supports",
      created: 0,
      modified: 0,
    },
  ],
  searchNodes: async () => ({
    nodes: [
      {
        id: "node-1",
        nodeTypeId: "claim",
        title: "CLM - Example",
        path: "nodes/CLM - Example.md",
      },
    ],
  }),
  getNode: async (nodeId) =>
    nodeId === "node-1"
      ? {
          id: "node-1",
          nodeTypeId: "claim",
          title: "CLM - Example",
          path: "nodes/CLM - Example.md",
          body: "Example body",
          frontmatter: { nodeTypeId: "claim", nodeInstanceId: "node-1" },
        }
      : null,
  getNodeRelations: async () => [],
  getNodeContext: async (nodeId) => {
    const node = await readFixture.getNode(nodeId);
    if (!node) {
      return null;
    }
    return { node, relations: [], relatedNodes: [] };
  },
};

const writeFixture = createMcpBridgeWriteApi(createMcpBridgeWriteStore());

const handlerFixture = {
  getHealth: () => healthFixture,
  getContext: async () => contextFixture,
  read: readFixture,
  write: writeFixture,
};

test("GET /health returns bridge health payload", async (t) => {
  const { server, baseUrl } = await listenOnRandomPort(handlerFixture);
  t.after(() => closeServer(server));

  const response = await fetch(`${baseUrl}${MCP_BRIDGE_HEALTH_PATH}`);
  assert.equal(response.status, 200);

  const body = (await response.json()) as McpBridgeHealth;
  assert.equal(body.ok, true);
  assert.equal(body.service, MCP_BRIDGE_SERVICE_NAME);
  assert.equal(body.vaultId, "vault-test-id");
});

test("GET /context returns bridge context payload", async (t) => {
  const { server, baseUrl } = await listenOnRandomPort(handlerFixture);
  t.after(() => closeServer(server));

  const response = await fetch(`${baseUrl}${MCP_BRIDGE_CONTEXT_PATH}`);
  assert.equal(response.status, 200);

  const body = (await response.json()) as McpBridgeContext;
  assert.equal(body.platform, "Obsidian");
  assert.equal(body.syncEnabled, true);
  assert.equal(body.spaceId, 7);
});

test("GET /node-types returns configured node types", async (t) => {
  const { server, baseUrl } = await listenOnRandomPort(handlerFixture);
  t.after(() => closeServer(server));

  const response = await fetch(`${baseUrl}${MCP_BRIDGE_NODE_TYPES_PATH}`);
  const body = (await response.json()) as {
    nodeTypes: Array<{ id: string; name: string }>;
  };
  assert.equal(body.nodeTypes[0]?.name, "Claim");
});

test("POST /search returns matching nodes", async (t) => {
  const { server, baseUrl } = await listenOnRandomPort(handlerFixture);
  t.after(() => closeServer(server));

  const response = await fetch(`${baseUrl}${MCP_BRIDGE_SEARCH_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "Example" }),
  });
  const body = (await response.json()) as { nodes: Array<{ id: string }> };
  assert.equal(body.nodes[0]?.id, "node-1");
});

test("GET /node/:id returns node payload", async (t) => {
  const { server, baseUrl } = await listenOnRandomPort(handlerFixture);
  t.after(() => closeServer(server));

  const response = await fetch(`${baseUrl}/node/node-1`);
  const body = (await response.json()) as { node: { body: string } };
  assert.equal(body.node.body, "Example body");
});

test("GET /node/:id returns 404 for missing node", async (t) => {
  const { server, baseUrl } = await listenOnRandomPort(handlerFixture);
  t.after(() => closeServer(server));

  const response = await fetch(`${baseUrl}/node/missing`);
  assert.equal(response.status, 404);
});

test("GET /relation-types and /discourse-relations return schema data", async (t) => {
  const { server, baseUrl } = await listenOnRandomPort(handlerFixture);
  t.after(() => closeServer(server));

  const relationTypes = await fetch(`${baseUrl}${MCP_BRIDGE_RELATION_TYPES_PATH}`);
  const discourseRelations = await fetch(
    `${baseUrl}${MCP_BRIDGE_DISCOURSE_RELATIONS_PATH}`,
  );

  const relationBody = (await relationTypes.json()) as {
    relationTypes: Array<{ id: string }>;
  };
  const discourseBody = (await discourseRelations.json()) as {
    discourseRelations: Array<{ id: string }>;
  };

  assert.equal(relationBody.relationTypes[0]?.id, "supports");
  assert.equal(discourseBody.discourseRelations[0]?.id, "rel1");
});

test("unknown route returns 404", async (t) => {
  const { server, baseUrl } = await listenOnRandomPort(handlerFixture);
  t.after(() => closeServer(server));

  const response = await fetch(`${baseUrl}/missing`);
  assert.equal(response.status, 404);
});
