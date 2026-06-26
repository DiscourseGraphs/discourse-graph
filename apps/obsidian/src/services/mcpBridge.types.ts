export const DEFAULT_MCP_BRIDGE_PORT = 3598;
export const MCP_BRIDGE_HEALTH_PATH = "/health";
export const MCP_BRIDGE_CONTEXT_PATH = "/context";
export const MCP_BRIDGE_NODE_TYPES_PATH = "/node-types";
export const MCP_BRIDGE_RELATION_TYPES_PATH = "/relation-types";
export const MCP_BRIDGE_DISCOURSE_RELATIONS_PATH = "/discourse-relations";
export const MCP_BRIDGE_SEARCH_PATH = "/search";
export const MCP_BRIDGE_SERVICE_NAME = "dg-obsidian-mcp-bridge";
export const MCP_BRIDGE_VERSION = "1";

export type McpBridgeHealth = {
  ok: true;
  service: typeof MCP_BRIDGE_SERVICE_NAME;
  version: typeof MCP_BRIDGE_VERSION;
  port: number;
  vaultId: string;
  vaultName: string;
};

export type McpBridgeContext = {
  platform: "Obsidian";
  vaultId: string;
  vaultName: string;
  syncEnabled: boolean;
  spaceId?: number;
  spaceUrl?: string;
  spacePassword?: string;
};

export const buildMcpBridgeHealth = ({
  port,
  vaultId,
  vaultName,
}: {
  port: number;
  vaultId: string;
  vaultName: string;
}): McpBridgeHealth => ({
  ok: true,
  service: MCP_BRIDGE_SERVICE_NAME,
  version: MCP_BRIDGE_VERSION,
  port,
  vaultId,
  vaultName,
});
