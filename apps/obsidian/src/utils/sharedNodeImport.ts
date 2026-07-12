export type SourceNodeConcept = {
  source_local_id: string;
  schema_id: number | null;
};

export type SourceNodeSchema = {
  id: number;
  source_local_id: string;
};

export const getImportedNodeKey = ({
  spaceId,
  sourceLocalId,
}: {
  spaceId: number;
  sourceLocalId: string;
}): string => `${spaceId}:${sourceLocalId}`;

export const getAvailableImportPath = async ({
  desiredPath,
  pathExists,
}: {
  desiredPath: string;
  pathExists: (path: string) => Promise<boolean>;
}): Promise<string> => {
  if (!(await pathExists(desiredPath))) return desiredPath;

  const extensionIndex = desiredPath.lastIndexOf(".");
  const basePath =
    extensionIndex > desiredPath.lastIndexOf("/")
      ? desiredPath.slice(0, extensionIndex)
      : desiredPath;
  const extension =
    extensionIndex > desiredPath.lastIndexOf("/")
      ? desiredPath.slice(extensionIndex)
      : "";

  let counter = 1;
  let availablePath = `${basePath} (${counter})${extension}`;
  while (await pathExists(availablePath)) {
    counter++;
    availablePath = `${basePath} (${counter})${extension}`;
  }
  return availablePath;
};

export const buildSourceNodeTypeIdMap = ({
  concepts,
  schemas,
}: {
  concepts: SourceNodeConcept[];
  schemas: SourceNodeSchema[];
}): Map<string, string> => {
  const sourceNodeTypeIdBySchemaId = new Map(
    schemas.map((schema) => [schema.id, schema.source_local_id]),
  );

  return new Map(
    concepts.flatMap((concept): [string, string][] => {
      if (concept.schema_id === null) return [];
      const sourceNodeTypeId = sourceNodeTypeIdBySchemaId.get(
        concept.schema_id,
      );
      return sourceNodeTypeId
        ? [[concept.source_local_id, sourceNodeTypeId]]
        : [];
    }),
  );
};

export const buildImportedNodeFrontmatter = ({
  existingFrontmatter,
  sourceNodeId,
  mappedNodeTypeId,
  importedFromRid,
  importedModifiedAt,
  authorId,
}: {
  existingFrontmatter: Record<string, unknown>;
  sourceNodeId: string;
  mappedNodeTypeId: string;
  importedFromRid: string;
  importedModifiedAt?: number;
  authorId?: number;
}): Record<string, unknown> => ({
  ...existingFrontmatter,
  nodeInstanceId: sourceNodeId,
  nodeTypeId: mappedNodeTypeId,
  importedFromRid,
  lastModified: importedModifiedAt,
  ...(authorId === undefined ? {} : { authorId }),
});
