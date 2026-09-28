import { difference } from "@repo/utils/setOperations";

export const diffSchemaIds = ({
  databaseSchemaIds,
  localSchemaIds,
}: {
  databaseSchemaIds: Iterable<string>;
  localSchemaIds: Iterable<string>;
}): { staleSchemaIds: Set<string>; missingSchemaIds: Set<string> } => {
  const database = new Set(databaseSchemaIds);
  const local = new Set(localSchemaIds);
  return {
    staleSchemaIds: difference(database, local),
    missingSchemaIds: difference(local, database),
  };
};

type SchemaReferenceProbeRow = {
  source_local_id: string | null;
  schema_id: number | null;
};

// Saving a schema does not update the nodes or relations saved before it, so
// they keep an empty schema reference until they are sent again.
export const findIdsMissingSchema = ({
  rows,
  items,
  typeIds,
}: {
  rows: SchemaReferenceProbeRow[];
  items: { id: string; typeId: string }[];
  typeIds: Set<string>;
}): Set<string> => {
  const idsWithoutSchema = new Set(
    rows
      .filter((row) => row.schema_id === null)
      .map((row) => row.source_local_id)
      .filter((id): id is string => id !== null),
  );
  return new Set(
    items
      .filter(
        (item) => idsWithoutSchema.has(item.id) && typeIds.has(item.typeId),
      )
      .map((item) => item.id),
  );
};
