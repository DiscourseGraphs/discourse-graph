import type { IncomingMessage, ServerResponse } from "node:http";
import {
  MCP_BRIDGE_CONTEXT_PATH,
  MCP_BRIDGE_DISCOURSE_RELATIONS_PATH,
  MCP_BRIDGE_HEALTH_PATH,
  MCP_BRIDGE_NODE_TYPES_PATH,
  MCP_BRIDGE_RELATION_TYPES_PATH,
  MCP_BRIDGE_SEARCH_PATH,
  type McpBridgeContext,
  type McpBridgeHealth,
} from "./mcpBridge.types.js";
import type { McpBridgeReadApi } from "./mcpBridgeRead.js";
import type {
  McpBridgeNodeContextResponse,
  McpBridgeNodePayload,
  McpBridgeRelationPayload,
  McpBridgeSearchResponse,
} from "./mcpBridgeRead.types.js";
import type { McpBridgeWriteApi } from "./mcpBridgeWrite.js";
import {
  MCP_BRIDGE_PENDING_WRITES_PATH,
  MCP_BRIDGE_PROPOSE_WRITE_PATH,
} from "./mcpBridgeWrite.types.js";
import {
  parseClearWriteBody,
  parseProposeWriteBody,
} from "./mcpBridgeWrite.js";

const bridgeBaseUrl = (port: number): string => `http://127.0.0.1:${port}`;

const writeJson = (
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void => {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(payload));
};

const writeNoContent = (response: ServerResponse): void => {
  response.writeHead(204, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Origin": "*",
  });
  response.end();
};

const readJsonBody = async (
  request: IncomingMessage,
): Promise<Record<string, unknown> | null> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
};

const parseNodeIdFromPath = (pathname: string): string | null => {
  const match = /^\/node\/([^/]+)$/.exec(pathname);
  return match?.[1] ?? null;
};

const parseNodeSubresourcePath = (
  pathname: string,
  suffix: "relations" | "context",
): string | null => {
  const match = new RegExp(`^/node/([^/]+)/${suffix}$`).exec(pathname);
  return match?.[1] ?? null;
};

const parsePendingWriteIdFromPath = (pathname: string): string | null => {
  const match = /^\/pending-write\/([^/]+)$/.exec(pathname);
  return match?.[1] ?? null;
};

const parseClearWriteIdFromPath = (pathname: string): string | null => {
  const match = /^\/clear-write\/([^/]+)$/.exec(pathname);
  return match?.[1] ?? null;
};

export type McpBridgeRequestHandler = {
  getHealth: () => McpBridgeHealth;
  getContext: () => Promise<McpBridgeContext>;
  read: McpBridgeReadApi;
  write: McpBridgeWriteApi;
};

export const handleMcpBridgeHttpRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  handler: McpBridgeRequestHandler,
): Promise<void> => {
  if (!request.url) {
    writeNoContent(response);
    return;
  }

  if (request.method === "OPTIONS") {
    writeNoContent(response);
    return;
  }

  const url = new URL(
    request.url,
    bridgeBaseUrl(handler.getHealth().port),
  );

  if (request.method === "GET" && url.pathname === MCP_BRIDGE_HEALTH_PATH) {
    writeJson(response, 200, handler.getHealth());
    return;
  }

  if (request.method === "GET" && url.pathname === MCP_BRIDGE_CONTEXT_PATH) {
    const context = await handler.getContext();
    writeJson(response, 200, context);
    return;
  }

  if (
    request.method === "GET" &&
    url.pathname === MCP_BRIDGE_PENDING_WRITES_PATH
  ) {
    writeJson(response, 200, {
      batches: handler.write.listPendingWrites(),
      pendingCount: handler.write.pendingCount(),
    });
    return;
  }

  if (
    request.method === "POST" &&
    url.pathname === MCP_BRIDGE_PROPOSE_WRITE_PATH
  ) {
    const body = await readJsonBody(request);
    if (body === null) {
      writeJson(response, 400, { ok: false, error: "Invalid JSON body" });
      return;
    }

    const input = parseProposeWriteBody(body);
    if (!input) {
      writeJson(response, 400, {
        ok: false,
        error:
          "Invalid propose-write payload. Expected non-empty operations[].",
      });
      return;
    }

    const result = handler.write.proposeWrite(input);
    writeJson(response, 200, result);
    return;
  }

  const pendingWriteId = parsePendingWriteIdFromPath(url.pathname);
  if (request.method === "GET" && pendingWriteId) {
    const pending = handler.write.getPendingWrite(pendingWriteId);
    if (!pending.batch) {
      writeJson(response, 404, {
        ok: false,
        error: `Write batch not found: ${pendingWriteId}`,
      });
      return;
    }
    writeJson(response, 200, pending);
    return;
  }

  const clearWriteId = parseClearWriteIdFromPath(url.pathname);
  if (request.method === "POST" && clearWriteId) {
    const body = await readJsonBody(request);
    if (body === null) {
      writeJson(response, 400, { ok: false, error: "Invalid JSON body" });
      return;
    }

    const resolution = parseClearWriteBody(body);
    const result = handler.write.clearWrite(clearWriteId, resolution);
    if (!result.cleared) {
      writeJson(response, 404, {
        ok: false,
        cleared: false,
        error: result.error,
      });
      return;
    }

    writeJson(response, 200, result);
    return;
  }

  if (request.method === "GET" && url.pathname === MCP_BRIDGE_NODE_TYPES_PATH) {
    writeJson(response, 200, { nodeTypes: handler.read.getNodeTypes() });
    return;
  }

  if (
    request.method === "GET" &&
    url.pathname === MCP_BRIDGE_RELATION_TYPES_PATH
  ) {
    writeJson(response, 200, {
      relationTypes: handler.read.getRelationTypes(),
    });
    return;
  }

  if (
    request.method === "GET" &&
    url.pathname === MCP_BRIDGE_DISCOURSE_RELATIONS_PATH
  ) {
    writeJson(response, 200, {
      discourseRelations: handler.read.getDiscourseRelations(),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === MCP_BRIDGE_SEARCH_PATH) {
    const body = await readJsonBody(request);
    if (body === null) {
      writeJson(response, 400, { ok: false, error: "Invalid JSON body" });
      return;
    }

    const query = typeof body.query === "string" ? body.query : "";
    const nodeTypeId =
      typeof body.nodeTypeId === "string" ? body.nodeTypeId : undefined;
    const results: McpBridgeSearchResponse = await handler.read.searchNodes({
      query,
      nodeTypeId,
    });
    writeJson(response, 200, results);
    return;
  }

  const nodeId = parseNodeIdFromPath(url.pathname);
  if (request.method === "GET" && nodeId) {
    const node: McpBridgeNodePayload | null = await handler.read.getNode(nodeId);
    if (!node) {
      writeJson(response, 404, {
        ok: false,
        error: `Node not found: ${nodeId}`,
      });
      return;
    }
    writeJson(response, 200, { node });
    return;
  }

  const relationsNodeId = parseNodeSubresourcePath(url.pathname, "relations");
  if (request.method === "GET" && relationsNodeId) {
    const relations: McpBridgeRelationPayload[] =
      await handler.read.getNodeRelations(relationsNodeId);
    writeJson(response, 200, { relations });
    return;
  }

  const contextNodeId = parseNodeSubresourcePath(url.pathname, "context");
  if (request.method === "GET" && contextNodeId) {
    const context: McpBridgeNodeContextResponse | null =
      await handler.read.getNodeContext(contextNodeId);
    if (!context) {
      writeJson(response, 404, {
        ok: false,
        error: `Node not found: ${contextNodeId}`,
      });
      return;
    }
    writeJson(response, 200, context);
    return;
  }

  writeJson(response, 404, {
    ok: false,
    error: `Unknown route: ${request.method} ${url.pathname}`,
  });
};
