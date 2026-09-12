import {
  isRelationSchemaDeleted,
  notifyRelationSchemaChange,
} from "./relationSchemaChanges";
import { DISCOURSE_GRAPH_PROP_NAME } from "./createReifiedBlock";
import getBlockProps from "./getBlockProps";
import { setBlockPropsAsync } from "./setBlockProps";
import {
  isJsonObject,
  parseImportedSourceIdentity,
  type ImportedSourceIdentity,
} from "./importedSourceIdentity";

type ImportStatus = "provisional" | "accepted";

export const RELATION_SCHEMA_STATUS_PROP_KEY = "status";
const ACCEPTED_STATUS: ImportStatus = "accepted";

export type RelationSchemaImportMeta = {
  importedFrom: ImportedSourceIdentity;
  status: ImportStatus;
};

// Origin (importedFrom) and acceptance (status) are stored as separate props so
// accepting never erases provenance; a schema with origin but no accepted
// status is provisional, which also covers schemas imported before acceptance
// existed.
export const readRelationSchemaImportMeta = (
  relationSchemaUid: string,
): RelationSchemaImportMeta | undefined => {
  const props = getBlockProps(relationSchemaUid);
  const importedFrom = parseImportedSourceIdentity(props);
  if (importedFrom === undefined) return undefined;
  const discourseGraphProps = props[DISCOURSE_GRAPH_PROP_NAME];
  const status =
    isJsonObject(discourseGraphProps) &&
    discourseGraphProps[RELATION_SCHEMA_STATUS_PROP_KEY] === ACCEPTED_STATUS
      ? ACCEPTED_STATUS
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
  relations.filter(
    (relation) =>
      !isRelationSchemaDeleted(relation.id) &&
      !isProvisionalRelationSchema(relation.id),
  );

export const acceptImportedRelationSchema = async (
  relationSchemaUid: string,
): Promise<void> => {
  const existing = getBlockProps(relationSchemaUid)[DISCOURSE_GRAPH_PROP_NAME];
  const discourseGraphProps = isJsonObject(existing) ? existing : {};
  await setBlockPropsAsync(relationSchemaUid, {
    [DISCOURSE_GRAPH_PROP_NAME]: {
      ...discourseGraphProps,
      [RELATION_SCHEMA_STATUS_PROP_KEY]: ACCEPTED_STATUS,
    },
  });
  notifyRelationSchemaChange();
};
