import type { App, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import {
  addRelation as addRelationToStore,
  getNodeInstanceIdForFile,
  loadRelations,
  findRelationBySourceDestinationType,
} from "~/utils/relationsStore";

/**
 * Persists a relation between two files to the relations store (relations.json).
 * No longer writes to frontmatter.
 *
 * @returns Object indicating whether the relation already existed and the relation instance id (if new).
 */

export const addRelationToRelationsJson = async ({
  app: _app,
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

  const data = await loadRelations(plugin);
  const existing = findRelationBySourceDestinationType(
    data,
    sourceId,
    destId,
    relationTypeId,
  );
  if (existing) {
    return { alreadyExisted: true, relationInstanceId: existing.id };
  }

  const relationInstanceId = await addRelationToStore(plugin, {
    type: relationTypeId,
    source: sourceId,
    destination: destId,
  });
  return { alreadyExisted: false, relationInstanceId };
};
