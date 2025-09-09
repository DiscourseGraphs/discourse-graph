import { PostgrestResponse } from "@supabase/supabase-js";
import type { Tables } from "../dbTypes";
import { DGSupabaseClient } from "./client";

type Concept = Tables<"Concept">;
type Content = Tables<"Content">;
type Document = Tables<"Document">;

export const NODE_SCHEMAS = "Node types";

export type NodeSignature = { id: number; name: string };

export const nodeSchemaSignature: NodeSignature = { id: 0, name: NODE_SCHEMAS };

type PDocument = Partial<Tables<"Document">>;
type PContent = Partial<Tables<"Content">> & {
  Document: PDocument | null;
};
export type PConcept = Partial<Tables<"Concept">> & {
  Content: PContent | null;
  schema_of_concept: { name: string } | null;
};

const composeQuery = ({
  supabase,
  spaceId = undefined,
  schemaName = NODE_SCHEMAS,
  conceptFields = ["id", "name"],
  contentFields = [],
  documentFields = [],
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  schemaName?: string | string[];
  conceptFields?: (keyof Concept)[];
  contentFields?: (keyof Content)[];
  documentFields?: (keyof Document)[];
}) => {
  let q = conceptFields.join(",\n");
  if (schemaName !== NODE_SCHEMAS) q += ",\nschema_of_concept(name)";
  if (contentFields.length > 0) {
    q += ",\nContent (\n" + contentFields.join(",\n");
    if (documentFields.length > 0) {
      q += ",\nDocument (\n" + documentFields.join(",\n") + ")";
    }
    q += ")";
  }
  let query = supabase.from("Concept").select(q).eq("arity", 0);
  if (spaceId !== null) query = query.eq("space_id", spaceId);
  if (schemaName === NODE_SCHEMAS) {
    query = query.eq("is_schema", true);
  } else {
    query = query.eq("is_schema", false).not("schema_of_concept", "is", null);
    if (Array.isArray(schemaName))
      query = query.in("schema_of_concept.name", schemaName);
    else if (typeof schemaName === "string")
      query = query.eq("schema_of_concept.name", schemaName);
    else throw new Error("schemaName should be a string or string[]");
  }
  return query;
};

export const getNodeSchemas = async (
  supabase: DGSupabaseClient,
  spaceId: number,
): Promise<NodeSignature[]> => {
  const q = composeQuery({ supabase, spaceId });
  const res = (await q) as PostgrestResponse<NodeSignature>;
  if (res.error) {
    console.error("getNodeSchemas failed", res.error);
    return [nodeSchemaSignature];
  }
  return [nodeSchemaSignature, ...(res.data || [])];
};

export const CONCEPT_FIELDS: (keyof Concept)[] = [
  "id",
  "name",
  "description",
  "author_id",
  "created",
  "last_modified",
  "space_id",
  "arity",
  "literal_content",
  "reference_content",
  "refs",
  "is_schema",
  "represented_by_id",
];

export const CONTENT_FIELDS: (keyof Content)[] = [
  "id",
  "source_local_id",
  "variant",
  "author_id",
  "creator_id",
  "created",
  "text",
  "metadata",
  "scale",
  "space_id",
  "last_modified",
  "part_of_id",
];

export const DOCUMENT_FIELDS: (keyof Document)[] = [
  "space_id",
  "source_local_id",
  "url",
  "created",
  "metadata",
  "last_modified",
  "author_id",
];

export const getNodes = async ({
  supabase,
  spaceId = undefined,
  schemaName = NODE_SCHEMAS,
  conceptFields = CONCEPT_FIELDS,
  contentFields = CONTENT_FIELDS,
  documentFields = DOCUMENT_FIELDS,
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  schemaName?: string | string[];
  conceptFields?: (keyof Concept)[];
  contentFields?: (keyof Content)[];
  documentFields?: (keyof Document)[];
}): Promise<PConcept[]> => {
  const q = composeQuery({
    supabase,
    spaceId,
    schemaName,
    conceptFields,
    contentFields,
    documentFields,
  });
  const { error, data } = (await q) as PostgrestResponse<PConcept>;
  if (error) {
    console.error("getNodes failed", error);
    return [];
  }
  return data || [];
};
