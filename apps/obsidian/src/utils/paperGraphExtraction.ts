import { Notice, requestUrl, type TFile } from "obsidian";
import { z } from "zod";
import type DiscourseGraphPlugin from "~/index";
import type {
  DiscourseNode,
  DiscourseRelation,
  DiscourseRelationType,
} from "~/types";
import { addRelationToRelationsJson } from "~/components/canvas/utils/relationJsonUtils";
import { createDiscourseNode } from "~/utils/createNode";

const DEFAULT_PAPER_GRAPH_MODEL = "claude-sonnet-4-6";
const LOG_PREFIX = "[paper graph extraction]";

const ExtractedPaperNodeSchema = z.object({
  id: z.string().min(1),
  nodeType: z.string().min(1),
  content: z.string().min(1),
  supportSnippet: z.string().optional(),
  sourceSection: z.string().nullable().optional(),
});

const ExtractedPaperRelationSchema = z.object({
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  relationType: z.string().min(1),
  rationale: z.string().optional(),
});

const ExtractedPaperNodesResponseSchema = z.object({
  nodes: z.array(ExtractedPaperNodeSchema),
});

const ExtractedPaperRelationsResponseSchema = z.object({
  relations: z.array(ExtractedPaperRelationSchema),
});

export const ExtractedPaperGraphSchema = z.object({
  nodes: z.array(ExtractedPaperNodeSchema),
  relations: z.array(ExtractedPaperRelationSchema),
});

export type ExtractedPaperNode = z.infer<typeof ExtractedPaperNodeSchema>;
export type ExtractedPaperRelation = z.infer<
  typeof ExtractedPaperRelationSchema
>;
export type ExtractedPaperGraph = z.infer<typeof ExtractedPaperGraphSchema>;

type NormalizedPaperNode = ExtractedPaperNode & {
  nodeTypeConfig: DiscourseNode;
};

type NormalizedPaperRelation = ExtractedPaperRelation & {
  relationTypeConfig: DiscourseRelationType;
  relationConfig: DiscourseRelation;
};

export type NormalizedPaperGraph = {
  nodes: NormalizedPaperNode[];
  relations: NormalizedPaperRelation[];
  skippedNodes: Array<{ node: ExtractedPaperNode; reason: string }>;
  skippedRelations: Array<{ relation: ExtractedPaperRelation; reason: string }>;
};

export type CreatedPaperNode = {
  extractedNode: NormalizedPaperNode;
  file: TFile;
};

export type PersistedPaperRelation = {
  relation: NormalizedPaperRelation;
  sourceFile: TFile;
  targetFile: TFile;
  alreadyExisted: boolean;
  relationInstanceId?: string;
};

export type ExtractPaperRelationsForExistingNodesResult = {
  sourceFile: TFile;
  existingNodes: CreatedPaperNode[];
  extractedGraph: ExtractedPaperGraph;
  normalizedGraph: NormalizedPaperGraph;
  persistedRelations: PersistedPaperRelation[];
};

export type CreatePaperDiscourseNodesResult = {
  extractedGraph: ExtractedPaperGraph;
  normalizedGraph: NormalizedPaperGraph;
  createdNodes: CreatedPaperNode[];
  persistedRelations: PersistedPaperRelation[];
};

const normalizeLabel = (value: string): string =>
  value.trim().toLowerCase().replace(/^#/, "");

const findNodeType = (
  nodeTypes: DiscourseNode[],
  extractedNodeType: string,
): DiscourseNode | undefined => {
  const normalized = normalizeLabel(extractedNodeType);
  return nodeTypes.find((nodeType) => {
    const candidates = [
      nodeType.name,
      nodeType.tag,
      nodeType.tag ? `#${nodeType.tag}` : undefined,
    ];
    return candidates.some(
      (candidate) => candidate && normalizeLabel(candidate) === normalized,
    );
  });
};

const getNodeTypeById = (
  nodeTypes: DiscourseNode[],
  nodeTypeId: string,
): DiscourseNode | undefined =>
  nodeTypes.find((nodeType) => nodeType.id === nodeTypeId);

const extractContentFromFileName = (
  fileBasename: string,
  nodeType: DiscourseNode,
): string => {
  const [rawPrefix, rawSuffix] = nodeType.format.split("{content}");
  const prefix = rawPrefix ?? "";
  const suffix = rawSuffix ?? "";
  if (fileBasename.startsWith(prefix) && fileBasename.endsWith(suffix)) {
    return fileBasename
      .slice(prefix.length, fileBasename.length - suffix.length)
      .trim();
  }
  return fileBasename;
};

const getMetadataLineValue = (
  content: string,
  label: string,
): string | null => {
  const line = content
    .split("\n")
    .find((line) => line.trim().startsWith(`${label}:`));
  if (!line) return null;
  return line.slice(line.indexOf(":") + 1).trim();
};

const getGeneratedFromLinks = (content: string): string[] => {
  const generatedFrom = getMetadataLineValue(content, "Generated from");
  if (!generatedFrom) return [];
  return [...generatedFrom.matchAll(/\[\[([^\]]+)\]\]/g)].map(
    (match) => match[1] ?? "",
  );
};

const isGeneratedFromSourceFile = ({
  content,
  sourceFile,
}: {
  content: string;
  sourceFile: TFile;
}): boolean => {
  const links = getGeneratedFromLinks(content);
  const candidates = new Set([
    sourceFile.basename,
    sourceFile.path,
    sourceFile.path.replace(/\.md$/i, ""),
  ]);
  return links.some((link) => candidates.has(link.split("|")[0] ?? link));
};

const stripWrappingQuotes = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const findRelationType = (
  relationTypes: DiscourseRelationType[],
  extractedRelationType: string,
): DiscourseRelationType | undefined => {
  const normalized = normalizeLabel(extractedRelationType);
  return relationTypes.find((relationType) =>
    [relationType.label, relationType.complement].some(
      (candidate) => normalizeLabel(candidate) === normalized,
    ),
  );
};

const findCompatibleRelation = ({
  discourseRelations,
  relationTypeId,
  sourceNodeTypeId,
  targetNodeTypeId,
}: {
  discourseRelations: DiscourseRelation[];
  relationTypeId: string;
  sourceNodeTypeId: string;
  targetNodeTypeId: string;
}): DiscourseRelation | undefined =>
  discourseRelations.find(
    (relation) =>
      relation.relationshipTypeId === relationTypeId &&
      relation.sourceId === sourceNodeTypeId &&
      relation.destinationId === targetNodeTypeId,
  );

const findOnlyCompatibleRelation = ({
  discourseRelations,
  sourceNodeTypeId,
  targetNodeTypeId,
}: {
  discourseRelations: DiscourseRelation[];
  sourceNodeTypeId: string;
  targetNodeTypeId: string;
}): DiscourseRelation | undefined => {
  const compatibleRelations = discourseRelations.filter(
    (relation) =>
      relation.sourceId === sourceNodeTypeId &&
      relation.destinationId === targetNodeTypeId,
  );
  return compatibleRelations.length === 1 ? compatibleRelations[0] : undefined;
};

export const normalizeExtractedPaperGraph = (
  plugin: DiscourseGraphPlugin,
  graph: ExtractedPaperGraph,
): NormalizedPaperGraph => {
  const skippedNodes: NormalizedPaperGraph["skippedNodes"] = [];
  const skippedRelations: NormalizedPaperGraph["skippedRelations"] = [];

  const nodes = graph.nodes.flatMap((node) => {
    const nodeTypeConfig = findNodeType(
      plugin.settings.nodeTypes,
      node.nodeType,
    );
    if (!nodeTypeConfig) {
      skippedNodes.push({
        node,
        reason: `Unknown node type "${node.nodeType}"`,
      });
      return [];
    }
    return [{ ...node, nodeTypeConfig }];
  });

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const relations = graph.relations.flatMap((relation) => {
    const sourceNode = nodesById.get(relation.sourceNodeId);
    const targetNode = nodesById.get(relation.targetNodeId);
    if (!sourceNode || !targetNode) {
      skippedRelations.push({
        relation,
        reason: "Relation references a skipped or missing node",
      });
      return [];
    }

    const relationTypeConfig = findRelationType(
      plugin.settings.relationTypes,
      relation.relationType,
    );
    const compatibleRelation = relationTypeConfig
      ? findCompatibleRelation({
          discourseRelations: plugin.settings.discourseRelations,
          relationTypeId: relationTypeConfig.id,
          sourceNodeTypeId: sourceNode.nodeTypeConfig.id,
          targetNodeTypeId: targetNode.nodeTypeConfig.id,
        })
      : findOnlyCompatibleRelation({
          discourseRelations: plugin.settings.discourseRelations,
          sourceNodeTypeId: sourceNode.nodeTypeConfig.id,
          targetNodeTypeId: targetNode.nodeTypeConfig.id,
        });

    if (!compatibleRelation) {
      skippedRelations.push({
        relation,
        reason: relationTypeConfig
          ? `Relation "${relation.relationType}" is not valid for the extracted node types`
          : `Unknown relation type "${relation.relationType}"`,
      });
      return [];
    }

    const resolvedRelationType =
      relationTypeConfig ??
      plugin.settings.relationTypes.find(
        (type) => type.id === compatibleRelation.relationshipTypeId,
      );

    if (!resolvedRelationType) {
      skippedRelations.push({
        relation,
        reason: "Compatible relation type is missing from settings",
      });
      return [];
    }

    return [
      {
        ...relation,
        relationTypeConfig: resolvedRelationType,
        relationConfig: compatibleRelation,
      },
    ];
  });

  return {
    nodes,
    relations,
    skippedNodes,
    skippedRelations,
  };
};

const buildNodeTypesPromptBlock = (plugin: DiscourseGraphPlugin): string =>
  plugin.settings.nodeTypes
    .map((nodeType) => {
      const details = [nodeType.name];
      if (nodeType.description) details.push(nodeType.description);
      if (nodeType.tag) details.push(`tag: #${nodeType.tag}`);
      return `- ${details.join(" - ")}`;
    })
    .join("\n");

const buildRelationTypesPromptBlock = (plugin: DiscourseGraphPlugin): string =>
  plugin.settings.relationTypes
    .map(
      (relationType) => `- ${relationType.label} / ${relationType.complement}`,
    )
    .join("\n");

const buildRelationTriplesPromptBlock = (
  plugin: DiscourseGraphPlugin,
): string => {
  const nodeTypesById = new Map(
    plugin.settings.nodeTypes.map((nodeType) => [nodeType.id, nodeType]),
  );
  const relationTypesById = new Map(
    plugin.settings.relationTypes.map((relationType) => [
      relationType.id,
      relationType,
    ]),
  );
  const relationTriples = plugin.settings.discourseRelations
    .map((relation) => {
      const sourceNodeType = nodeTypesById.get(relation.sourceId);
      const targetNodeType = nodeTypesById.get(relation.destinationId);
      const relationType = relationTypesById.get(relation.relationshipTypeId);
      if (!sourceNodeType || !targetNodeType || !relationType) return null;
      return `- ${sourceNodeType.name} --${relationType.label}-> ${targetNodeType.name}`;
    })
    .filter((line): line is string => line !== null)
    .join("\n");

  return relationTriples || "- No relation triples configured.";
};

const buildPaperNodesSystemPrompt = (plugin: DiscourseGraphPlugin): string => {
  const nodeTypes = buildNodeTypesPromptBlock(plugin);

  return `You extract discourse graph nodes from academic paper markdown.
Return only strict JSON with this shape:
{
  "nodes": [
    {
      "id": "n1",
      "nodeType": "Claim",
      "content": "Atomic self-contained node text",
      "supportSnippet": "Direct quote from the paper",
      "sourceSection": "Results"
    }
  ]
}

Use 8-25 high-quality nodes. Prefer atomic, faithful, self-contained nodes.
Do not extract relations in this step. A later step will generate relations from the final generated node list.

Only use node types from this list:
${nodeTypes}

Use stable node ids n1, n2, n3, etc.`;
};

const buildPaperRelationsSystemPrompt = (
  plugin: DiscourseGraphPlugin,
): string => {
  const relationTypes = buildRelationTypesPromptBlock(plugin);
  const relationTriples = buildRelationTriplesPromptBlock(plugin);

  return `You extract discourse graph relations from academic paper markdown and a fixed list of generated discourse nodes.
Return only strict JSON with this shape:
{
  "relations": [
    {
      "sourceNodeId": "n1",
      "targetNodeId": "n2",
      "relationType": "supports",
      "rationale": "Short reason for this edge"
    }
  ]
}

You must only create relations between the provided generated nodes. Do not invent new nodes.
A relation means the paper gives enough textual evidence to connect two generated nodes.
Aim for the strongest 8-30 relations. It is better to return a sparse, meaningful graph than a fully connected graph.
Only return an empty "relations" array if there is just one node or no defensible relationship among the generated nodes.

Only use relation labels from this list:
${relationTypes}

Only create relation edges that match one of these allowed source type -> relation -> target type triples:
${relationTriples}

Relation direction matters. For every relation, sourceNodeId must be a node whose nodeType matches the source type in an allowed triple, and targetNodeId must match the target type.
Use the relation label, not the complement, in relationType.
Useful default patterns:
- Evidence supports Claim when an observation backs up an interpretation.
- Evidence opposes Claim when an observation contradicts an interpretation.
- Evidence informs Question when an observation is relevant to answering a question.
- Evidence derived from Source when an observation comes from a specific source node.

Every relation endpoint must reference one of the provided generated node ids.`;
};

const extractJsonTextFromAnthropicResponse = (
  responseJson: unknown,
): string => {
  const content = (responseJson as { content?: Array<{ text?: unknown }> })
    .content;
  const text = content?.find((item) => typeof item.text === "string")?.text;
  if (typeof text !== "string") {
    throw new Error("Anthropic returned an empty response");
  }
  return text;
};

const extractJsonFromModelText = (rawText: string): string => {
  const trimmed = rawText.trim();
  const fencedJson = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedJson?.[1] ?? trimmed;
};

const parsePaperNodesResponse = (rawText: string): ExtractedPaperNode[] => {
  const jsonText = extractJsonFromModelText(rawText);
  console.log(`${LOG_PREFIX} parseable nodes JSON text`, jsonText);
  const parsed = ExtractedPaperNodesResponseSchema.parse(JSON.parse(jsonText));
  console.log(`${LOG_PREFIX} parsed nodes`, parsed.nodes);
  return parsed.nodes;
};

const parsePaperRelationsResponse = (
  rawText: string,
): ExtractedPaperRelation[] => {
  const jsonText = extractJsonFromModelText(rawText);
  console.log(`${LOG_PREFIX} parseable relations JSON text`, jsonText);
  const parsed = ExtractedPaperRelationsResponseSchema.parse(
    JSON.parse(jsonText),
  );
  console.log(`${LOG_PREFIX} parsed relations`, parsed.relations);
  return parsed.relations;
};

const requestAnthropicText = async ({
  systemPrompt,
  userPrompt,
  apiKey,
  model,
  logLabel,
}: {
  systemPrompt: string;
  userPrompt: string;
  apiKey: string;
  model: string;
  logLabel: string;
}): Promise<string> => {
  console.log(`${LOG_PREFIX} starting ${logLabel} LLM call`, {
    model,
    userPromptLength: userPrompt.length,
  });

  const response = await requestUrl({
    url: "https://api.anthropic.com/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 12000,
      temperature: 0.4,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });

  if (response.status < 200 || response.status >= 300) {
    console.error(`${LOG_PREFIX} Anthropic ${logLabel} error response`, {
      status: response.status,
      text: response.text,
    });
    throw new Error(`Anthropic API error (${response.status})`);
  }

  console.log(`${LOG_PREFIX} Anthropic ${logLabel} response`, response.json);
  const rawText = extractJsonTextFromAnthropicResponse(response.json);
  console.log(`${LOG_PREFIX} raw ${logLabel} model text`, rawText);
  return rawText;
};

export const extractPaperNodesFromMarkdown = async ({
  plugin,
  markdown,
  apiKey,
  model = DEFAULT_PAPER_GRAPH_MODEL,
}: {
  plugin: DiscourseGraphPlugin;
  markdown: string;
  apiKey: string;
  model?: string;
}): Promise<ExtractedPaperNode[]> => {
  const rawText = await requestAnthropicText({
    apiKey,
    model,
    logLabel: "node extraction",
    systemPrompt: buildPaperNodesSystemPrompt(plugin),
    userPrompt: `Extract discourse graph nodes from this paper markdown:\n\n${markdown}`,
  });
  return parsePaperNodesResponse(rawText);
};

export const extractPaperRelationsFromMarkdown = async ({
  plugin,
  markdown,
  nodes,
  apiKey,
  model = DEFAULT_PAPER_GRAPH_MODEL,
}: {
  plugin: DiscourseGraphPlugin;
  markdown: string;
  nodes: NormalizedPaperNode[];
  apiKey: string;
  model?: string;
}): Promise<ExtractedPaperRelation[]> => {
  const generatedNodes = nodes.map((node) => ({
    id: node.id,
    nodeType: node.nodeTypeConfig.name,
    content: node.content,
    supportSnippet: node.supportSnippet,
    sourceSection: node.sourceSection,
  }));

  const rawText = await requestAnthropicText({
    apiKey,
    model,
    logLabel: "relation extraction",
    systemPrompt: buildPaperRelationsSystemPrompt(plugin),
    userPrompt: `Generate discourse graph relations among these generated nodes:\n\n${JSON.stringify(
      generatedNodes,
      null,
      2,
    )}\n\nUse this source paper markdown as evidence:\n\n${markdown}`,
  });

  return parsePaperRelationsResponse(rawText);
};

const buildNodeMetadataBlock = ({
  node,
  sourceFile,
  plugin,
}: {
  node: NormalizedPaperNode;
  sourceFile?: TFile;
  plugin: DiscourseGraphPlugin;
}): string => {
  const lines = ["", "## Extraction metadata", ""];

  if (sourceFile) {
    const linkText = plugin.app.metadataCache.fileToLinktext(
      sourceFile,
      sourceFile.path,
    );
    lines.push(`Generated from: [[${linkText}]]`, "");
  }

  if (node.sourceSection) {
    lines.push(`Source section: ${node.sourceSection}`, "");
  }

  if (node.supportSnippet) {
    lines.push(`Source quote: "${node.supportSnippet}"`, "");
  }

  return lines.join("\n");
};

const persistNormalizedPaperRelations = async ({
  plugin,
  normalizedGraph,
  paperNodes,
}: {
  plugin: DiscourseGraphPlugin;
  normalizedGraph: NormalizedPaperGraph;
  paperNodes: CreatedPaperNode[];
}): Promise<PersistedPaperRelation[]> => {
  const filesByExtractedNodeId = new Map(
    paperNodes.map(({ extractedNode, file }) => [extractedNode.id, file]),
  );
  const persistedRelations: PersistedPaperRelation[] = [];

  for (const relation of normalizedGraph.relations) {
    const sourceFile = filesByExtractedNodeId.get(relation.sourceNodeId);
    const targetFile = filesByExtractedNodeId.get(relation.targetNodeId);

    if (!sourceFile || !targetFile) {
      console.warn(`${LOG_PREFIX} could not persist relation`, {
        relation,
        reason: "Relation endpoint file not found",
      });
      continue;
    }

    const result = await addRelationToRelationsJson({
      plugin,
      sourceFile,
      targetFile,
      relationTypeId: relation.relationTypeConfig.id,
    });

    persistedRelations.push({
      relation,
      sourceFile,
      targetFile,
      alreadyExisted: result.alreadyExisted,
      relationInstanceId: result.relationInstanceId,
    });

    console.log(`${LOG_PREFIX} persisted relation`, {
      sourceNodeId: relation.sourceNodeId,
      targetNodeId: relation.targetNodeId,
      relationType: relation.relationType,
      sourceFile: sourceFile.path,
      targetFile: targetFile.path,
      alreadyExisted: result.alreadyExisted,
      relationInstanceId: result.relationInstanceId,
    });
  }

  console.log(`${LOG_PREFIX} completed relation persistence`, {
    persistedCount: persistedRelations.length,
    createdCount: persistedRelations.filter(
      (relation) => !relation.alreadyExisted,
    ).length,
    existingCount: persistedRelations.filter(
      (relation) => relation.alreadyExisted,
    ).length,
  });

  return persistedRelations;
};

export const findExistingPaperNodesForSourceFile = async ({
  plugin,
  sourceFile,
}: {
  plugin: DiscourseGraphPlugin;
  sourceFile: TFile;
}): Promise<CreatedPaperNode[]> => {
  const candidates: CreatedPaperNode[] = [];
  const markdownFiles = plugin.app.vault.getMarkdownFiles();

  for (const file of markdownFiles) {
    if (file.path === sourceFile.path) continue;

    const cache = plugin.app.metadataCache.getFileCache(file);
    const nodeTypeId = cache?.frontmatter?.nodeTypeId as string | undefined;
    if (!nodeTypeId) continue;

    const nodeTypeConfig = getNodeTypeById(
      plugin.settings.nodeTypes,
      nodeTypeId,
    );
    if (!nodeTypeConfig) continue;

    const content = await plugin.app.vault.read(file);
    if (!isGeneratedFromSourceFile({ content, sourceFile })) continue;

    const sourceSection = getMetadataLineValue(content, "Source section");
    const supportSnippet = getMetadataLineValue(content, "Source quote");

    candidates.push({
      file,
      extractedNode: {
        id: "",
        nodeType: nodeTypeConfig.name,
        content: extractContentFromFileName(file.basename, nodeTypeConfig),
        sourceSection,
        supportSnippet: supportSnippet
          ? stripWrappingQuotes(supportSnippet)
          : undefined,
        nodeTypeConfig,
      },
    });
  }

  return candidates
    .sort((a, b) => a.file.path.localeCompare(b.file.path))
    .map((candidate, index) => ({
      ...candidate,
      extractedNode: {
        ...candidate.extractedNode,
        id: `n${index + 1}`,
      },
    }));
};

export const extractPaperRelationsForExistingNodes = async ({
  plugin,
  sourceFile,
  apiKey,
}: {
  plugin: DiscourseGraphPlugin;
  sourceFile: TFile;
  apiKey: string;
}): Promise<ExtractPaperRelationsForExistingNodesResult> => {
  const markdown = await plugin.app.vault.read(sourceFile);
  const existingNodes = await findExistingPaperNodesForSourceFile({
    plugin,
    sourceFile,
  });

  console.log(`${LOG_PREFIX} relation-only existing nodes`, {
    sourceFile: sourceFile.path,
    existingNodes: existingNodes.map(({ extractedNode, file }) => ({
      id: extractedNode.id,
      nodeType: extractedNode.nodeTypeConfig.name,
      content: extractedNode.content,
      path: file.path,
    })),
  });

  const extractedRelations =
    existingNodes.length > 1
      ? await extractPaperRelationsFromMarkdown({
          plugin,
          markdown,
          nodes: existingNodes.map(({ extractedNode }) => extractedNode),
          apiKey,
        })
      : [];

  const extractedGraph: ExtractedPaperGraph = {
    nodes: existingNodes.map(({ extractedNode }) => ({
      id: extractedNode.id,
      nodeType: extractedNode.nodeType,
      content: extractedNode.content,
      supportSnippet: extractedNode.supportSnippet,
      sourceSection: extractedNode.sourceSection,
    })),
    relations: extractedRelations,
  };
  const normalizedGraph = normalizeExtractedPaperGraph(plugin, extractedGraph);

  console.log(`${LOG_PREFIX} relation-only normalized graph`, {
    nodes: normalizedGraph.nodes,
    relations: normalizedGraph.relations,
    skippedRelations: normalizedGraph.skippedRelations,
  });

  const persistedRelations = await persistNormalizedPaperRelations({
    plugin,
    normalizedGraph,
    paperNodes: existingNodes,
  });

  return {
    sourceFile,
    existingNodes,
    extractedGraph,
    normalizedGraph,
    persistedRelations,
  };
};

export const createPaperDiscourseNodesFromMarkdown = async ({
  plugin,
  markdown,
  apiKey,
  sourceFile,
}: {
  plugin: DiscourseGraphPlugin;
  markdown: string;
  apiKey: string;
  sourceFile?: TFile;
}): Promise<CreatePaperDiscourseNodesResult> => {
  console.log(`${LOG_PREFIX} create nodes from markdown`, {
    sourceFile: sourceFile?.path,
    markdownLength: markdown.length,
  });

  const extractedNodes = await extractPaperNodesFromMarkdown({
    plugin,
    markdown,
    apiKey,
  });
  console.log(`${LOG_PREFIX} extracted nodes`, extractedNodes);

  const normalizedNodeGraph = normalizeExtractedPaperGraph(plugin, {
    nodes: extractedNodes,
    relations: [],
  });
  console.log(`${LOG_PREFIX} normalized nodes`, {
    nodes: normalizedNodeGraph.nodes,
    skippedNodes: normalizedNodeGraph.skippedNodes,
  });

  const createdNodes: CreatedPaperNode[] = [];

  for (const node of normalizedNodeGraph.nodes) {
    console.log(`${LOG_PREFIX} creating discourse node file`, {
      extractedNodeId: node.id,
      nodeType: node.nodeTypeConfig.name,
      content: node.content,
    });

    const file = await createDiscourseNode({
      plugin,
      nodeType: node.nodeTypeConfig,
      text: node.content,
    });
    if (!file) {
      console.warn(`${LOG_PREFIX} skipped file creation`, {
        extractedNodeId: node.id,
        content: node.content,
      });
      continue;
    }

    const metadataBlock = buildNodeMetadataBlock({
      node,
      sourceFile,
      plugin,
    });

    await plugin.app.vault.process(file, (content) => {
      if (content.includes("## Extraction metadata")) return content;
      return `${content.trimEnd()}\n${metadataBlock}`;
    });

    createdNodes.push({ extractedNode: node, file });
    console.log(`${LOG_PREFIX} created discourse node file`, {
      extractedNodeId: node.id,
      path: file.path,
    });
  }

  console.log(`${LOG_PREFIX} completed node creation`, {
    createdCount: createdNodes.length,
    createdNodes: createdNodes.map(({ extractedNode, file }) => ({
      extractedNodeId: extractedNode.id,
      path: file.path,
    })),
  });

  const generatedNodes = createdNodes.map(({ extractedNode }) => extractedNode);
  const extractedRelations =
    generatedNodes.length > 1
      ? await extractPaperRelationsFromMarkdown({
          plugin,
          markdown,
          nodes: generatedNodes,
          apiKey,
        })
      : [];
  console.log(`${LOG_PREFIX} extracted relations`, extractedRelations);

  const extractedGraph: ExtractedPaperGraph = {
    nodes: generatedNodes.map((node) => ({
      id: node.id,
      nodeType: node.nodeType,
      content: node.content,
      supportSnippet: node.supportSnippet,
      sourceSection: node.sourceSection,
    })),
    relations: extractedRelations,
  };

  const normalizedGraph = normalizeExtractedPaperGraph(plugin, extractedGraph);
  console.log(`${LOG_PREFIX} final normalized graph`, {
    nodes: normalizedGraph.nodes,
    relations: normalizedGraph.relations,
    skippedNodes: normalizedGraph.skippedNodes,
    skippedRelations: normalizedGraph.skippedRelations,
  });

  const persistedRelations = await persistNormalizedPaperRelations({
    plugin,
    normalizedGraph,
    paperNodes: createdNodes,
  });

  new Notice(
    `Created ${createdNodes.length} discourse node(s), extracted ${normalizedGraph.relations.length} relation(s), and persisted ${persistedRelations.length}.`,
    5000,
  );

  return {
    extractedGraph,
    normalizedGraph,
    createdNodes,
    persistedRelations,
  };
};
