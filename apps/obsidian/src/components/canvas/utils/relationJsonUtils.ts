import { Notice, type TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { addRelation, getNodeInstanceIdForFile } from "~/utils/relationsStore";

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
  relationshipTypeId?: string;
  relationshipTargetFile?: TFile;
  isCurrentFileSource?: boolean;
};

export const addRelationIfRequested = async (
  plugin: DiscourseGraphPlugin,
  createdOrSelectedFile: TFile,
  params: RelationParams,
): Promise<void> => {
  const { relationshipTypeId, relationshipTargetFile, isCurrentFileSource } =
    params;
  if (!relationshipTypeId || !relationshipTargetFile) return;
  if (relationshipTargetFile === createdOrSelectedFile) return;

  const [sourceFile, targetFile] =
    isCurrentFileSource === true
      ? [relationshipTargetFile, createdOrSelectedFile]
      : [createdOrSelectedFile, relationshipTargetFile];
  await addRelationToRelationsJson({
    plugin,
    sourceFile,
    targetFile,
    relationTypeId: relationshipTypeId,
  });
};