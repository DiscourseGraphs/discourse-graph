import type { App, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { addRelation, getNodeInstanceIdForFile } from "~/utils/relationsStore";

/**
 * Persists a relation between two files to the relations store (relations.json).
 * Uses addRelation (checks for existing relation by default).
 *
 * @returns Object indicating whether the relation already existed and the relation instance id.
 */
export const addRelationToRelationsJson = async ({
  app,
  plugin,
  sourceFile,
  targetFile,
  relationTypeId,
}: {
  app: App;
  plugin: DiscourseGraphPlugin;
  sourceFile: TFile;
  targetFile: TFile;
  relationTypeId: string;
}): Promise<{ alreadyExisted: boolean; relationInstanceId?: string }> => {
  const sourceId = await getNodeInstanceIdForFile(plugin, sourceFile);
  const destId = await getNodeInstanceIdForFile(plugin, targetFile);
  if (!sourceId || !destId) {
    console.warn("Could not resolve nodeInstanceIds for relation files");
    return { alreadyExisted: false };
  }

  const { id, alreadyExisted } = await addRelation(plugin, {
    type: relationTypeId,
    source: sourceId,
    destination: destId,
  });
  return { alreadyExisted, relationInstanceId: id };
};
