import { normalizePath, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type { DiscourseNode } from "~/types";
import { addRelationToRelationsJson } from "~/components/canvas/utils/relationJsonUtils";
import {
  createDiscourseNodeFile,
  formatNodeName,
} from "~/utils/createNode";
import { checkInvalidChars } from "~/utils/validateNodeType";
import {
  getNodeTypeIdForFile,
  resolveEndpointToFile,
} from "~/utils/relationsStore";
import type { McpBridgeWriteOperation } from "./mcpBridgeWrite.types.js";

export type WriteExecutionResult =
  | { ok: true }
  | { ok: false; error: string };

const getNodeTypeById = (
  plugin: DiscourseGraphPlugin,
  nodeTypeId: string,
): DiscourseNode | null =>
  plugin.settings.nodeTypes.find((nodeType) => nodeType.id === nodeTypeId) ??
  null;

const resolveUpdateTargetFile = (
  plugin: DiscourseGraphPlugin,
  operation: Extract<McpBridgeWriteOperation, { kind: "update_node" }>,
): TFile | null => {
  if (operation.nodeInstanceId) {
    return resolveEndpointToFile(plugin, operation.nodeInstanceId);
  }

  if (!operation.filename) {
    return null;
  }

  const trimmed = operation.filename.trim();
  const asPath = trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
  const normalizedPath = normalizePath(asPath);
  const byPath = plugin.app.vault.getAbstractFileByPath(normalizedPath);
  if (byPath instanceof TFile) {
    return byPath;
  }

  const basename = normalizedPath.split("/").pop()?.replace(/\.md$/, "") ?? trimmed;
  return plugin.app.metadataCache.getFirstLinkpathDest(basename, "");
};

const renameDiscourseNode = async (
  plugin: DiscourseGraphPlugin,
  file: TFile,
  nodeType: DiscourseNode,
  titleContent: string,
): Promise<TFile> => {
  const formattedNodeName = formatNodeName(titleContent, nodeType);
  if (!formattedNodeName) {
    throw new Error("Could not format discourse node title.");
  }

  const validation = checkInvalidChars(formattedNodeName);
  if (!validation.isValid) {
    throw new Error(validation.error ?? "Invalid node title.");
  }

  const folderPath =
    nodeType.folderPath?.trim() || plugin.settings.nodesFolderPath.trim();
  const newPath = folderPath
    ? normalizePath(`${folderPath}/${formattedNodeName}.md`)
    : normalizePath(
        file.parent?.path
          ? `${file.parent.path}/${formattedNodeName}.md`
          : `${formattedNodeName}.md`,
      );

  if (file.path === newPath) {
    return file;
  }

  const destinationFile = plugin.app.vault.getAbstractFileByPath(newPath);
  if (destinationFile instanceof TFile && destinationFile.path !== file.path) {
    throw new Error(`Destination file already exists at ${newPath}`);
  }

  if (folderPath) {
    const folderExists = plugin.app.vault.getAbstractFileByPath(folderPath);
    if (!folderExists) {
      await plugin.app.vault.createFolder(folderPath);
    }
  }

  await plugin.app.fileManager.renameFile(file, newPath);
  const renamed = plugin.app.vault.getAbstractFileByPath(newPath);
  if (!(renamed instanceof TFile)) {
    throw new Error(`Renamed file not found at ${newPath}`);
  }
  return renamed;
};

const executeCreateNode = async (
  plugin: DiscourseGraphPlugin,
  operation: Extract<McpBridgeWriteOperation, { kind: "create_node" }>,
): Promise<WriteExecutionResult> => {
  const nodeType = getNodeTypeById(plugin, operation.nodeTypeId);
  if (!nodeType) {
    return { ok: false, error: `Unknown node type: ${operation.nodeTypeId}` };
  }

  const formattedNodeName = formatNodeName(operation.content, nodeType);
  if (!formattedNodeName) {
    return { ok: false, error: "Could not format node title." };
  }

  const validation = checkInvalidChars(formattedNodeName);
  if (!validation.isValid) {
    return { ok: false, error: validation.error ?? "Invalid node title." };
  }

  const file = await createDiscourseNodeFile({
    plugin,
    formattedNodeName,
    nodeType,
  });

  if (!file) {
    return { ok: false, error: "Failed to create discourse node file." };
  }

  if (operation.body) {
    await plugin.app.vault.process(file, () => operation.body ?? "");
  }

  return { ok: true };
};

const executeUpdateNode = async (
  plugin: DiscourseGraphPlugin,
  operation: Extract<McpBridgeWriteOperation, { kind: "update_node" }>,
): Promise<WriteExecutionResult> => {
  const file = resolveUpdateTargetFile(plugin, operation);
  if (!file) {
    return {
      ok: false,
      error: "Could not resolve target node for update.",
    };
  }

  let targetFile = file;

  if (operation.title !== undefined) {
    const nodeTypeId = await getNodeTypeIdForFile(plugin, targetFile);
    if (!nodeTypeId) {
      return { ok: false, error: "Target file is not a discourse node." };
    }

    const nodeType = getNodeTypeById(plugin, nodeTypeId);
    if (!nodeType) {
      return { ok: false, error: `Unknown node type: ${nodeTypeId}` };
    }

    try {
      targetFile = await renameDiscourseNode(
        plugin,
        targetFile,
        nodeType,
        operation.title,
      );
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (operation.content !== undefined) {
    await plugin.app.vault.process(targetFile, () => operation.content ?? "");
  }

  return { ok: true };
};

const executeCreateRelation = async (
  plugin: DiscourseGraphPlugin,
  operation: Extract<McpBridgeWriteOperation, { kind: "create_relation" }>,
): Promise<WriteExecutionResult> => {
  const sourceFile = resolveEndpointToFile(plugin, operation.sourceId);
  const destinationFile = resolveEndpointToFile(plugin, operation.destinationId);

  if (!sourceFile || !destinationFile) {
    return {
      ok: false,
      error: "Could not resolve source or destination node for relation.",
    };
  }

  const { alreadyExisted } = await addRelationToRelationsJson({
    plugin,
    sourceFile,
    targetFile: destinationFile,
    relationTypeId: operation.relationTypeId,
  });

  if (alreadyExisted) {
    return { ok: false, error: "Relation already exists." };
  }

  return { ok: true };
};

export const executeWriteOperation = async (
  plugin: DiscourseGraphPlugin,
  operation: McpBridgeWriteOperation,
): Promise<WriteExecutionResult> => {
  switch (operation.kind) {
    case "create_node":
      return executeCreateNode(plugin, operation);
    case "update_node":
      return executeUpdateNode(plugin, operation);
    case "create_relation":
      return executeCreateRelation(plugin, operation);
    default:
      return { ok: false, error: "Unknown write operation." };
  }
};

export const executeWriteBatch = async (
  plugin: DiscourseGraphPlugin,
  operations: McpBridgeWriteOperation[],
): Promise<WriteExecutionResult> => {
  for (const operation of operations) {
    const result = await executeWriteOperation(plugin, operation);
    if (!result.ok) {
      return result;
    }
  }
  return { ok: true };
};
