import { DISCOURSE_GRAPH_PROP_NAME } from "./createReifiedBlock";
import getBlockProps from "./getBlockProps";
import { setBlockPropsAsync } from "./setBlockProps";
import {
  isJsonObject,
  readImportedSourceIdentity,
  type ImportedSourceIdentity,
} from "./importedSourceIdentity";

export type RelationSchemaImportStatus = "provisional" | "accepted";

export const RELATION_SCHEMA_STATUS_PROP_KEY = "status";

export type RelationSchemaImportMeta = {
  importedFrom: ImportedSourceIdentity;
  status: RelationSchemaImportStatus;
};

// Origin (importedFrom) and acceptance (status) are stored as separate props so
// accepting never erases provenance; a schema with origin but no accepted
// status is provisional, which also covers schemas imported before acceptance
// existed.
export const readRelationSchemaImportMeta = (
  relationSchemaUid: string,
): RelationSchemaImportMeta | undefined => {
  const importedFrom = readImportedSourceIdentity(relationSchemaUid);
  if (importedFrom === undefined) return undefined;
  const discourseGraphProps =
    getBlockProps(relationSchemaUid)[DISCOURSE_GRAPH_PROP_NAME];
  const status =
    isJsonObject(discourseGraphProps) &&
    discourseGraphProps[RELATION_SCHEMA_STATUS_PROP_KEY] === "accepted"
      ? "accepted"
      : "provisional";
  return { importedFrom, status };
};

export const isProvisionalRelationSchema = (
  relationSchemaUid: string,
): boolean =>
  readRelationSchemaImportMeta(relationSchemaUid)?.status === "provisional";

export const excludeProvisionalRelationSchemas = <T extends { id: string }>(
  relations: T[],
): T[] =>
  relations.filter((relation) => !isProvisionalRelationSchema(relation.id));

export const acceptImportedRelationSchema = async (
  relationSchemaUid: string,
): Promise<void> => {
  const existing = getBlockProps(relationSchemaUid)[DISCOURSE_GRAPH_PROP_NAME];
  const discourseGraphProps = isJsonObject(existing) ? existing : {};
  await setBlockPropsAsync(relationSchemaUid, {
    [DISCOURSE_GRAPH_PROP_NAME]: {
      ...discourseGraphProps,
      [RELATION_SCHEMA_STATUS_PROP_KEY]: "accepted",
    },
  });
};
