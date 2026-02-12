import { Notice, type TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
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
  const sourceId = await getNodeInstanceIdForFile(plugin, sourceFile);
  const destId = await getNodeInstanceIdForFile(plugin, targetFile);

  if (!sourceId || !destId) {
    const missing: string[] = [];
    if (!sourceId) missing.push(`source (${sourceFile.basename})`);
    if (!destId) missing.push(`target (${targetFile.basename})`);
    console.warn(
      "Could not resolve nodeInstanceIds for relation files:",
      missing.join(", "),
    );
    new Notice(
      "Could not create relation: one or both files are not discourse nodes or metadata is not ready.",
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
    console.warn(
      "addRelationIfRequested: could not resolve node types for one or both files",
    );
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
    console.warn(
      "addRelationIfRequested: file node types do not match relation definition",
    );
    return;
  }

  await addRelationToRelationsJson({
    plugin,
    sourceFile,
    targetFile,
    relationTypeId: relation.relationshipTypeId,
  });
};