import { Notice, type TFile } from "obsidian";
import type { Editor } from "tldraw";
import type DiscourseGraphPlugin from "~/index";
import {
  DiscourseNodeShape,
  DiscourseNodeUtil,
} from "~/components/canvas/shapes/DiscourseNodeShape";
import { showToast } from "~/components/canvas/utils/toastUtils";
import {
  addRelation,
  getNodeInstanceIdForFile,
  getNodeTypeIdForFile,
} from "~/utils/relationsStore";

/**
 * Persists a relation between two files to the relations store (relations.json).
 * Uses addRelation (checks for existing relation by default).
 *
 * @returns Object indicating whether the relation already existed and the relation instance id.
 */
export const addRelationToRelationsJson = async ({
  plugin,
  sourceFile,
  targetFile,
  relationTypeId,
}: {
  plugin: DiscourseGraphPlugin;
  sourceFile: TFile;
  targetFile: TFile;
  relationTypeId: string;
}): Promise<{ alreadyExisted: boolean; relationInstanceId?: string }> => {
  const [sourceId, destId] = await Promise.all([
    getNodeInstanceIdForFile(plugin, sourceFile),
    getNodeInstanceIdForFile(plugin, targetFile),
  ]);

  if (!sourceId || !destId) {
    const missing: string[] = [];
    if (!sourceId) missing.push(`source (${sourceFile.basename})`);
    if (!destId) missing.push(`target (${targetFile.basename})`);
    new Notice(
      `Could not create relation: ${missing.join(" and ")} could not be resolved as discourse nodes.`,
      3000,
    );
    return { alreadyExisted: false };
  }

  const { id, alreadyExisted } = await addRelation(plugin, {
    type: relationTypeId,
    source: sourceId,
    destination: destId,
  });
  return { alreadyExisted, relationInstanceId: id };
};

type PersistRelationBetweenNodesResult =
  | {
      ok: true;
      relationInstanceId: string;
      sourceFile: TFile;
      targetFile: TFile;
      alreadyExisted: boolean;
    }
  | { ok: false };

export const persistRelationBetweenNodeShapes = async ({
  plugin,
  canvasFile,
  editor,
  startNode,
  endNode,
  relationTypeId,
}: {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
  editor: Editor;
  startNode: DiscourseNodeShape;
  endNode: DiscourseNodeShape;
  relationTypeId: string;
}): Promise<PersistRelationBetweenNodesResult> => {
  const nodeCtx = { app: plugin.app, canvasFile };
  const startNodeUtil = editor.getShapeUtil(startNode);
  const endNodeUtil = editor.getShapeUtil(endNode);

  if (
    !(startNodeUtil instanceof DiscourseNodeUtil) ||
    !(endNodeUtil instanceof DiscourseNodeUtil)
  ) {
    return { ok: false };
  }

  const [sourceFile, targetFile] = await Promise.all([
    startNodeUtil.getFile(startNode, nodeCtx),
    endNodeUtil.getFile(endNode, nodeCtx),
  ]);

  if (!sourceFile || !targetFile) {
    showToast({
      severity: "warning",
      title: "Failed to Save Relation",
      description: "Could not resolve files for the connected nodes",
      targetCanvasId: canvasFile.path,
    });
    return { ok: false };
  }

  try {
    const { alreadyExisted, relationInstanceId } =
      await addRelationToRelationsJson({
        plugin,
        sourceFile,
        targetFile,
        relationTypeId,
      });

    if (!relationInstanceId) {
      return { ok: false };
    }

    return {
      ok: true,
      relationInstanceId,
      sourceFile,
      targetFile,
      alreadyExisted,
    };
  } catch (error) {
    console.error("Failed to persist relation:", error);
    showToast({
      severity: "error",
      title: "Failed to Save Relation",
      description: "Could not save relation to files",
      targetCanvasId: canvasFile.path,
    });
    return { ok: false };
  }
};

type RelationParams = {
  /** DiscourseRelation.id; when set, a relation is created between the two files. */
  relationshipId?: string;
  relationshipTargetFile?: TFile;
};

export const addRelationIfRequested = async (
  plugin: DiscourseGraphPlugin,
  createdOrSelectedFile: TFile,
  params: RelationParams,
): Promise<void> => {
  const { relationshipId, relationshipTargetFile } = params;
  if (!relationshipId || !relationshipTargetFile) return;
  if (relationshipTargetFile === createdOrSelectedFile) return;

  const relation = plugin.settings.discourseRelations.find(
    (r) => r.id === relationshipId,
  );
  if (!relation) return;

  const [typeA, typeB] = await Promise.all([
    getNodeTypeIdForFile(plugin, createdOrSelectedFile),
    getNodeTypeIdForFile(plugin, relationshipTargetFile),
  ]);
  if (!typeA || !typeB) {
    return;
  }

  let sourceFile: TFile;
  let targetFile: TFile;
  if (relation.sourceId === typeA && relation.destinationId === typeB) {
    sourceFile = createdOrSelectedFile;
    targetFile = relationshipTargetFile;
  } else if (relation.sourceId === typeB && relation.destinationId === typeA) {
    sourceFile = relationshipTargetFile;
    targetFile = createdOrSelectedFile;
  } else if (relation.sourceId === relation.destinationId) {
    sourceFile = createdOrSelectedFile;
    targetFile = relationshipTargetFile;
  } else {
    return;
  }

  await addRelationToRelationsJson({
    plugin,
    sourceFile,
    targetFile,
    relationTypeId: relation.relationshipTypeId,
  });
};
