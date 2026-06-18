export const MCP_BRIDGE_NODE_TYPES_PATH = "/node-types";
export const MCP_BRIDGE_RELATION_TYPES_PATH = "/relation-types";
export const MCP_BRIDGE_DISCOURSE_RELATIONS_PATH = "/discourse-relations";
export const MCP_BRIDGE_SEARCH_PATH = "/search";

export type McpBridgeNodeSummary = {
  id: string;
  nodeTypeId: string;
  title: string;
  path: string;
};

export type McpBridgeNodePayload = McpBridgeNodeSummary & {
  body: string;
  created?: number;
  modified?: number;
  importedFromRid?: string;
  frontmatter: Record<string, unknown>;
};

export type McpBridgeRelationPayload = {
  id: string;
  type: string;
  source: string;
  destination: string;
  created?: number;
  lastModified?: number;
  importedFromRid?: string;
  tentative?: boolean;
};

export type McpBridgeSearchResponse = {
  nodes: McpBridgeNodeSummary[];
};

export type McpBridgeNodeContextResponse = {
  node: McpBridgeNodePayload;
  relations: McpBridgeRelationPayload[];
  relatedNodes: McpBridgeNodeSummary[];
};
