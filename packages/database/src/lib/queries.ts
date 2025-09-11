import { PostgrestResponse } from "@supabase/supabase-js";
import type { Tables } from "../dbTypes";
import { DGSupabaseClient } from "./client";

// the functions you are most likely to use are getNodeSchemas and getNodes.

type Concept = Tables<"Concept">;
type Content = Tables<"Content">;
type Document = Tables<"Document">;

export const NODE_SCHEMAS = "__schemas";

export type NodeSignature = {
  dbId: number;
  spaceId: number;
  sourceLocalId: string;
  name: string;
};

export const nodeSchemaSignature: NodeSignature = {
  spaceId: 0,
  sourceLocalId: NODE_SCHEMAS,
  name: "Node types",
  dbId: 0,
};

let NODE_SCHEMA_CACHE: Record<string, NodeSignature | number> = {
  NODE_SCHEMAS: nodeSchemaSignature,
};

export type PDocument = Partial<Tables<"Document">>;
export type PContent = Partial<Tables<"Content">> & {
  Document: PDocument | null;
};
export type PConcept = Partial<Tables<"Concept">> & {
  Content: PContent | null;
  schema_of_concept: { name: string } | null;
};

type defaultQueryShape = {
  id: number;
  space_id: number;
  name: string;
  Content: { source_local_id: string };
};

// Utility function to compose a generic query to fetch concepts, content and document.
const composeQuery = ({
  supabase,
  spaceId,
  schemaDbIds = 0,
  conceptFields = ["id", "name", "space_id"],
  contentFields = ["source_local_id"],
  documentFields = [],
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  schemaDbIds?: number | number[];
  conceptFields?: (keyof Concept)[];
  contentFields?: (keyof Content)[];
  documentFields?: (keyof Document)[];
}) => {
  let q = conceptFields.join(",\n");
  if (contentFields.length > 0) {
    q += ",\nContent (\n" + contentFields.join(",\n");
    if (documentFields.length > 0) {
      q += ",\nDocument (\n" + documentFields.join(",\n") + ")";
    }
    q += ")";
  }
  let query = supabase.from("Concept").select(q).eq("arity", 0);
  if (spaceId !== undefined) query = query.eq("space_id", spaceId);
  if (schemaDbIds === 0) {
    query = query.eq("is_schema", true);
  } else {
    query = query.eq("is_schema", false);
    if (Array.isArray(schemaDbIds)) query = query.in("schema_id", schemaDbIds);
    else if (typeof schemaDbIds === "number")
      query = query.eq("schema_id", schemaDbIds);
    else throw new Error("schemaDbIds should be a number or number[]");
  }
  return query;
};

// Obtain basic data for all node schemas in a space, populating the cache.
export const getNodeSchemas = async (
  supabase: DGSupabaseClient,
  spaceId: number,
  forceReload: boolean = false,
): Promise<NodeSignature[]> => {
  let result = Object.values(NODE_SCHEMA_CACHE)
    .filter((x) => typeof x === "object")
    .filter((x) => x.spaceId === spaceId);
  if (forceReload || result.length === 0) {
    const q = composeQuery({ supabase, spaceId });
    const res = (await q) as PostgrestResponse<defaultQueryShape>;
    if (res.error) {
      console.error("getNodeSchemas failed", res.error);
      return [NODE_SCHEMA_CACHE[NODE_SCHEMAS] as NodeSignature];
    }
    NODE_SCHEMA_CACHE = {
      ...NODE_SCHEMA_CACHE,
      ...Object.fromEntries(
        res.data.map((x) => [
          x.Content.source_local_id,
          {
            dbId: x.id,
            spaceId: x.space_id,
            sourceLocalId: x.Content.source_local_id,
            name: x.name,
          },
        ]),
      ),
    };
    result = Object.values(NODE_SCHEMA_CACHE)
      .filter((x) => typeof x === "object")
      .filter((x) => x.spaceId === spaceId);
  }
  return result;
};

const INTERVAL = 5000;

// Utility function: Get the databaseIds from the schema's Uids, looking first in Cache then querying db.
const getDbIds = async (
  supabase: DGSupabaseClient,
  localUids: string[],
  spaceId?: number,
): Promise<Record<string, number | null>> => {
  // assuming no collision with types' local Ids.
  const partialResult: [k: string, v: number | NodeSignature | undefined][] =
    localUids.map((x) => [x, NODE_SCHEMA_CACHE[x]]);
  const getDbId = (x: NodeSignature | number | undefined) =>
    typeof x === "object" ? x.dbId : null;
  let dbIds: Record<string, number | null> = Object.fromEntries(
    partialResult.map(([k, v]) => [k, getDbId(v)]),
  );
  let numMissing = Object.values(dbIds).filter((x) => x === null).length;
  if (numMissing === 0) return dbIds;
  const previousMisses = Object.fromEntries(
    partialResult.filter(([k, v]) => typeof v === "number"),
  ) as Record<string, number>;
  const numPreviousMisses = Object.values(previousMisses).length;
  const now = Date.now();
  const oldestMiss =
    numPreviousMisses > 0 ? Math.min(...Object.values(previousMisses)) : now;
  if (numMissing > numPreviousMisses || now - oldestMiss > INTERVAL) {
    if (spaceId === undefined) {
      console.error("Cannot populate cache without spaceId");
      return dbIds;
    }
    let q = composeQuery({ supabase, spaceId });
    if (Object.keys(NODE_SCHEMA_CACHE).length > 1) {
      // Non-empty cache, query selectively
      q = q
        .in("Content.source_local_id", localUids)
        .not("Content.source_local_id", "is", null);
    } // otherwise populate the cache
    const res = (await q) as PostgrestResponse<defaultQueryShape>;
    if (res.error) {
      console.error("could not get db Ids", res.error);
      return dbIds;
    }
    NODE_SCHEMA_CACHE = {
      ...NODE_SCHEMA_CACHE,
      ...Object.fromEntries(
        res.data.map((x) => [
          x.Content.source_local_id,
          {
            dbId: x.id,
            spaceId: x.space_id,
            sourceLocalId: x.Content.source_local_id,
            name: x.name,
          },
        ]),
      ),
    };
    for (const uid of localUids) {
      if (typeof NODE_SCHEMA_CACHE[uid] !== "object")
        NODE_SCHEMA_CACHE[uid] = now;
    }
    dbIds = Object.fromEntries(
      localUids.map((x) => [x, getDbId(NODE_SCHEMA_CACHE[x])]),
    );
  }
  return dbIds;
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

// get all nodes that belong to a certain number of schemas.
// This query will return Concept objects, and associated Content and Document,
// according to which fields are requested. Defaults to maximal information.
export const getNodes = async ({
  supabase,
  spaceId,
  schemaUids = NODE_SCHEMAS,
  conceptFields = CONCEPT_FIELDS,
  contentFields = CONTENT_FIELDS,
  documentFields = DOCUMENT_FIELDS,
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  schemaUids?: string | string[];
  conceptFields?: (keyof Concept)[];
  contentFields?: (keyof Content)[];
  documentFields?: (keyof Document)[];
}): Promise<PConcept[]> => {
  let schemaDbIds: number | number[] = 0;
  const uidsArray = typeof schemaUids === "string" ? [schemaUids] : schemaUids;
  if (schemaUids !== NODE_SCHEMAS) {
    const dbIdsMap = await getDbIds(supabase, uidsArray);
    schemaDbIds = Object.values(dbIdsMap).filter((x) => x !== null);
    if (schemaDbIds.length < schemaUids.length) {
      console.error(
        "Some uids are not yet in database: ",
        uidsArray.filter((uid) => dbIdsMap[uid] === undefined).join(", "),
      );
    }
  }
  const q = composeQuery({
    supabase,
    spaceId,
    schemaDbIds,
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
