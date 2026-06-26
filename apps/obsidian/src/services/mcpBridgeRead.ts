import type { TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type {
  DiscourseRelation,
  DiscourseRelationType,
  RelationInstance,
} from "~/types";
import { getFrontmatterForFile } from "~/components/canvas/shapes/discourseNodeShapeUtils";
import { QueryEngine } from "~/services/QueryEngine";
import {
  getRelationsForFile,
  resolveEndpointToFile,
} from "~/utils/relationsStore";
import { ensureNodeInstanceId } from "~/utils/nodeInstanceId";
import type {
  McpBridgeNodeContextResponse,
  McpBridgeNodePayload,
  McpBridgeNodeSummary,
  McpBridgeRelationPayload,
  McpBridgeSearchResponse,
} from "./mcpBridgeRead.types.js";

const MIN_SEARCH_LENGTH = 2;

const mapRelation = (relation: RelationInstance): McpBridgeRelationPayload => ({
  id: relation.id,
  type: relation.type,
  source: relation.source,
  destination: relation.destination,
  created: relation.created,
  lastModified: relation.lastModified,
  importedFromRid: relation.importedFromRid,
  tentative: relation.tentative,
});

const mapFileToSummary = async (
  plugin: DiscourseGraphPlugin,
  file: TFile,
): Promise<McpBridgeNodeSummary | null> => {
  const frontmatter = getFrontmatterForFile(plugin.app, file);
  const nodeTypeId = frontmatter?.nodeTypeId;
  if (typeof nodeTypeId !== "string" || !nodeTypeId) {
    return null;
  }

  const nodeInstanceId = await ensureNodeInstanceId(
    plugin,
    file,
    (frontmatter ?? {}) as Record<string, unknown>,
  );

  return {
    id: nodeInstanceId,
    nodeTypeId,
    title: file.basename,
    path: file.path,
  };
};

const mapFileToNodePayload = async (
  plugin: DiscourseGraphPlugin,
  file: TFile,
): Promise<McpBridgeNodePayload | null> => {
  const summary = await mapFileToSummary(plugin, file);
  if (!summary) {
    return null;
  }

  const frontmatter = getFrontmatterForFile(plugin.app, file) ?? {};
  const body = await plugin.app.vault.cachedRead(file);

  return {
    ...summary,
    body,
    created: file.stat?.ctime,
    modified: file.stat?.mtime,
    importedFromRid:
      typeof frontmatter.importedFromRid === "string"
        ? frontmatter.importedFromRid
        : undefined,
    frontmatter: frontmatter as Record<string, unknown>,
  };
};

const searchNodesInVault = (
  plugin: DiscourseGraphPlugin,
  query: string,
  nodeTypeId?: string,
): TFile[] => {
  const queryEngine = new QueryEngine(plugin.app);
  const fromDatacore = queryEngine.searchDiscourseNodesByTitle(query, nodeTypeId);
  if (fromDatacore.length > 0) {
    return fromDatacore;
  }

  const normalizedQuery = query.toLowerCase();
  return queryEngine
    .getFilesWithNodeTypeId()
    .filter((file) => {
      if (nodeTypeId) {
        const fm = getFrontmatterForFile(plugin.app, file);
        if (fm?.nodeTypeId !== nodeTypeId) {
          return false;
        }
      }
      return file.basename.toLowerCase().includes(normalizedQuery);
    });
};

const resolveNodeFile = (
  plugin: DiscourseGraphPlugin,
  nodeId: string,
): TFile | null => {
  const queryEngine = new QueryEngine(plugin.app);
  return queryEngine.getFileByEndpoint(nodeId) ?? resolveEndpointToFile(plugin, nodeId);
};

export type McpBridgeReadApi = {
  getNodeTypes: () => Array<{
    id: string;
    name: string;
    format: string;
    description?: string;
    color?: string;
    tag?: string;
  }>;
  getRelationTypes: () => DiscourseRelationType[];
  getDiscourseRelations: () => DiscourseRelation[];
  searchNodes: (params: {
    query: string;
    nodeTypeId?: string;
  }) => Promise<McpBridgeSearchResponse>;
  getNode: (nodeId: string) => Promise<McpBridgeNodePayload | null>;
  getNodeRelations: (nodeId: string) => Promise<McpBridgeRelationPayload[]>;
  getNodeContext: (
    nodeId: string,
  ) => Promise<McpBridgeNodeContextResponse | null>;
};

export const createMcpBridgeReadApi = (
  plugin: DiscourseGraphPlugin,
): McpBridgeReadApi => ({
  getNodeTypes: () =>
    plugin.settings.nodeTypes.map((nodeType) => ({
      id: nodeType.id,
      name: nodeType.name,
      format: nodeType.format,
      description: nodeType.description,
      color: nodeType.color,
      tag: nodeType.tag,
    })),

  getRelationTypes: () => plugin.settings.relationTypes,

  getDiscourseRelations: () => plugin.settings.discourseRelations,

  searchNodes: async ({ query, nodeTypeId }) => {
    if (!query || query.length < MIN_SEARCH_LENGTH) {
      return { nodes: [] };
    }

    const files = searchNodesInVault(plugin, query, nodeTypeId);
    const nodes: McpBridgeNodeSummary[] = [];

    for (const file of files) {
      const summary = await mapFileToSummary(plugin, file);
      if (summary) {
        nodes.push(summary);
      }
    }

    return { nodes };
  },

  getNode: async (nodeId) => {
    const file = resolveNodeFile(plugin, nodeId);
    if (!file) {
      return null;
    }
    return mapFileToNodePayload(plugin, file);
  },

  getNodeRelations: async (nodeId) => {
    const file = resolveNodeFile(plugin, nodeId);
    if (!file) {
      return [];
    }
    const relations = await getRelationsForFile(plugin, file);
    return relations.map(mapRelation);
  },

  getNodeContext: async (nodeId) => {
    const file = resolveNodeFile(plugin, nodeId);
    if (!file) {
      return null;
    }

    const node = await mapFileToNodePayload(plugin, file);
    if (!node) {
      return null;
    }

    const relations = (await getRelationsForFile(plugin, file)).map(mapRelation);
    const endpointIds = new Set<string>();
    for (const relation of relations) {
      endpointIds.add(relation.source);
      endpointIds.add(relation.destination);
    }
    endpointIds.delete(node.id);

    const relatedNodes: McpBridgeNodeSummary[] = [];
    for (const endpointId of endpointIds) {
      const relatedFile = resolveEndpointToFile(plugin, endpointId);
      if (!relatedFile) {
        continue;
      }
      const summary = await mapFileToSummary(plugin, relatedFile);
      if (summary) {
        relatedNodes.push(summary);
      }
    }

    return {
      node,
      relations,
      relatedNodes,
    };
  },
});
