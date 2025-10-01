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
  name: "Node Types",
  dbId: 0,
};

type CacheMissTimestamp = number;
type CacheEntry = NodeSignature | CacheMissTimestamp;
let NODE_SCHEMA_CACHE: Record<string, CacheEntry> = {
  [NODE_SCHEMAS]: nodeSchemaSignature,
};

export const initNodeSchemaCache = () => {
  NODE_SCHEMA_CACHE = {
    [NODE_SCHEMAS]: nodeSchemaSignature,
  };
}

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
//  - schemaDbIds = 0  → fetch schemas (is_schema = true)
//  - schemaDbIds = n  → fetch nodes under schema with dbId n (is_schema = false, eq schema_id)
//  - schemaDbIds = [] → fetch all nodes (is_schema = false, no filter on schema_id)
//  - schemaDbIds = [a,b,...] → fetch nodes under any of those schemas
const composeQuery = ({
  supabase,
  spaceId,
  schemaDbIds = 0,
  conceptFields = ["id", "name", "space_id"],
  contentFields = ["source_local_id"],
  documentFields = [],
  nodeAuthor = undefined,
  fetchNodes = true,
  inRelsOfType = undefined,
  relationFields = undefined,
  relationToNodeFields = undefined,
  inRelsToNodesOfType = undefined,
  inRelsToNodesOfAuthor = undefined,
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  schemaDbIds?: number | number[];
  conceptFields?: (keyof Concept)[];
  contentFields?: (keyof Content)[];
  documentFields?: (keyof Document)[];
  nodeAuthor?: string | undefined;
  fetchNodes?: boolean | null;
  inRelsOfType?: number[];
  relationFields?: (keyof Concept)[];
  relationToNodeFields?: (keyof Concept)[];
  inRelsToNodesOfType?: number[];
  inRelsToNodesOfAuthor?: number;
}) => {
  let q = conceptFields.join(",\n");
  if (schemaDbIds === 0 && !contentFields.includes("source_local_id")) {
    contentFields = contentFields.slice();
    contentFields.push("source_local_id");
  }
  if (contentFields.length > 0) {
    const args: string[] = contentFields.slice();
    if (documentFields.length > 0) {
      args.push("Document (\n" + documentFields.join(",\n") + ")");
    }
    q += `,\nContent${schemaDbIds === 0 ? "!inner" : ""} (\n${args.join(",\n")})`;
  }
  if (nodeAuthor !== undefined) {
    q += ", author:author_id!inner(account_local_id)";
  }
  if (
    inRelsOfType !== undefined ||
    inRelsToNodesOfType !== undefined ||
    inRelsToNodesOfAuthor !== undefined
  ) {
    const args: string[] = (relationFields || []).slice();
    if (inRelsOfType !== undefined && !args.includes("schema_id"))
      args.push("schema_id");
    if (
      inRelsToNodesOfType !== undefined ||
      inRelsToNodesOfAuthor !== undefined
    ) {
      const args2: string[] = (relationToNodeFields || []).slice();
      if (inRelsToNodesOfType !== undefined && !args2.includes("schema_id"))
        args2.push("schema_id");
      if (inRelsToNodesOfAuthor !== undefined && !args2.includes("author_id"))
        args2.push("author_id");
      args.push(`subnodes:concepts_of_relation!inner(${args2.join(",\n")})`);
    }
    q += `, relations:concept_in_relations!inner(${args.join(",\n")})`;
  }
  let query = supabase.from("Concept").select(q);
  if (fetchNodes === true) {
    query = query.eq("arity", 0);
  } else if (fetchNodes === false) {
    query = query.gt("arity", 0);
  }
  // else fetch both

  if (spaceId !== undefined) query = query.eq("space_id", spaceId);
  if (nodeAuthor !== undefined) {
    query = query.eq("author.account_local_id", nodeAuthor);
  }
  if (schemaDbIds === 0) {
    query = query.eq("is_schema", true);
  } else {
    query = query.eq("is_schema", false);
    if (Array.isArray(schemaDbIds)) {
      if (schemaDbIds.length > 0) query = query.in("schema_id", schemaDbIds);
      // else we'll get all nodes
    } else if (typeof schemaDbIds === "number")
      query = query.eq("schema_id", schemaDbIds);
    else throw new Error("schemaDbIds should be a number or number[]");
  }
  if (inRelsOfType !== undefined && inRelsOfType.length > 0)
    query = query.in("relations.schema_id", inRelsOfType);
  if (inRelsToNodesOfType !== undefined && inRelsToNodesOfType.length > 0)
    query = query.in("relations.subnodes.schema_id", inRelsToNodesOfType);
  if (inRelsToNodesOfAuthor !== undefined)
    query = query.eq("relations.subnodes.author_id", inRelsToNodesOfAuthor);
  // console.debug(query);
  return query;
};

// Obtain basic data for all node schemas in a space, populating the cache.
export const getNodeSchemas = async (
  supabase: DGSupabaseClient,
  spaceId: number,
  forceCacheReload: boolean = false,
): Promise<NodeSignature[]> => {
  let result = Object.values(NODE_SCHEMA_CACHE)
    .filter((x) => typeof x === "object")
    .filter((x) => x.spaceId === spaceId || x.spaceId === 0);
  if (forceCacheReload || result.length === 1) {
    const q = composeQuery({ supabase, spaceId, fetchNodes: null });
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
      .filter((x) => x.spaceId === spaceId || x.spaceId === 0);
  }
  return result;
};

const INTERVAL = 5000;

// Utility function: Get the mapping of local ids to db Ids, looking first in Cache then querying db.
const getLocalToDbIdMapping = async (
  supabase: DGSupabaseClient,
  localLocalIds: string[],
  spaceId?: number,
): Promise<Record<string, number | null>> => {
  // assuming no collision with types' local Ids.
  const partialResult: [k: string, v: CacheEntry | undefined][] =
    localLocalIds.map((x) => [x, NODE_SCHEMA_CACHE[x]]);
  const getDbId = (x: CacheEntry | undefined) =>
    typeof x === "object" ? x.dbId : null;
  let dbIds: Record<string, number | null> = Object.fromEntries(
    partialResult.map(([k, v]) => [k, getDbId(v)]),
  );
  const numMissing = Object.values(dbIds).filter((x) => x === null).length;
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
      console.warn("Cannot populate cache without spaceId");
      return dbIds;
    }
    let q = composeQuery({ supabase, spaceId });
    if (Object.keys(NODE_SCHEMA_CACHE).length > 1) {
      // Non-empty cache, query selectively
      q = q
        .in("Content.source_local_id", localLocalIds)
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
    for (const localId of localLocalIds) {
      if (typeof NODE_SCHEMA_CACHE[localId] !== "object")
        NODE_SCHEMA_CACHE[localId] = now;
    }
    dbIds = Object.fromEntries(
      localLocalIds.map((x) => [x, getDbId(NODE_SCHEMA_CACHE[x])]),
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
  "schema_id",
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
// Main call options:
// • ALL schemas:              schemaLocalIds = "__schemas" (default)
// • ALL nodes (instances):    schemaLocalIds = []
// • Nodes from X,Y schemas:   schemaLocalIds = ["localIdX","localIdY",...]
export const getNodes = async ({
  supabase,
  spaceId,
  schemaLocalIds = NODE_SCHEMAS,
  conceptFields = CONCEPT_FIELDS,
  contentFields = CONTENT_FIELDS,
  documentFields = DOCUMENT_FIELDS,
  nodeAuthor = undefined,
  fetchNodes = true,
  inRelsOfTypeLocal = undefined,
  relationFields = undefined,
  relationToNodeFields = undefined,
  inRelsToNodesOfTypeLocal = undefined,
  inRelsToNodesOfAuthor = undefined,
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  schemaLocalIds?: string | string[];
  conceptFields?: (keyof Concept)[];
  contentFields?: (keyof Content)[];
  documentFields?: (keyof Document)[];
  nodeAuthor?: string | undefined;
  fetchNodes?: boolean | null;
  inRelsOfTypeLocal?: string[];
  relationFields?: (keyof Concept)[];
  relationToNodeFields?: (keyof Concept)[];
  inRelsToNodesOfTypeLocal?: string[];
  inRelsToNodesOfAuthor?: number;
}): Promise<PConcept[]> => {
  const schemaLocalIdsArray =
    typeof schemaLocalIds === "string" ? [schemaLocalIds] : schemaLocalIds;
  const localIds = new Set<string>(schemaLocalIds);
  if (inRelsOfTypeLocal !== undefined)
    inRelsOfTypeLocal.map((k) => localIds.add(k));
  if (inRelsToNodesOfTypeLocal !== undefined)
    inRelsToNodesOfTypeLocal.map((k) => localIds.add(k));
  const dbIdsMapping = await getLocalToDbIdMapping(
    supabase,
    new Array(...localIds.keys()),
    spaceId,
  );
  const localToDbArray = (a: string[] | undefined): number[] | undefined => {
    if (a === undefined) return undefined;
    const r = a
      .map((k) => dbIdsMapping[k])
      .filter((k) => k !== null && k !== undefined);
    if (r.length < a.length) {
      console.error(
        "Some localIds are not yet in database: ",
        a.filter((k) => !dbIdsMapping[k]).join(", "),
      );
    }
    return r;
  };
  const schemaDbIds =
    schemaLocalIds === NODE_SCHEMAS ? 0 : localToDbArray(schemaLocalIdsArray);

  const q = composeQuery({
    supabase,
    spaceId,
    schemaDbIds,
    conceptFields,
    contentFields,
    documentFields,
    nodeAuthor,
    fetchNodes,
    inRelsOfType: localToDbArray(inRelsOfTypeLocal),
    relationFields,
    relationToNodeFields,
    inRelsToNodesOfType: localToDbArray(inRelsToNodesOfTypeLocal),
    inRelsToNodesOfAuthor,
  });
  const { error, data } = (await q) as PostgrestResponse<PConcept>;
  if (error) {
    console.error("getNodes failed", error);
    return [];
  }
  return data || [];
};
