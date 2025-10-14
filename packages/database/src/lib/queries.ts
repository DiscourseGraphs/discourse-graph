import { PostgrestResponse } from "@supabase/supabase-js";
import type { Tables } from "../dbTypes";
import { DGSupabaseClient } from "./client";

// the functions you are most likely to use are getSchemaConcepts and getConcepts.

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
const NODE_SCHEMA_CACHE: Record<string, CacheEntry> = {
  [NODE_SCHEMAS]: nodeSchemaSignature,
};

export const initNodeSchemaCache = () => {
  Object.keys(NODE_SCHEMA_CACHE).map((k) => {
    if (k !== NODE_SCHEMAS) delete NODE_SCHEMA_CACHE[k];
  });
};

/* eslint-disable @typescript-eslint/naming-convention */
export type PDocument = Partial<Tables<"Document">>;
export type PContent = Partial<Tables<"Content">> & {
  Document?: PDocument | null;
};
export type PAccount = Partial<Tables<"PlatformAccount">>;
export type PConceptBase = Partial<Tables<"Concept">>;
export type PConceptSubNode = PConceptBase & {
  Concept?: { source_local_id: string } | null;
  author?: { account_local_id: string } | null;
};
export type PRelConcept = PConceptBase & {
  subnodes?: PConceptSubNode[];
};

export type PConceptFull = PConceptBase & {
  Content?: PContent | null;
  author?: PAccount;
  relations?: PRelConcept[];
};

type DefaultQueryShape = {
  id: number;
  space_id: number;
  name: string;
  Content: { source_local_id: string };
};
/* eslint-enable @typescript-eslint/naming-convention */

// Utility function to compose a generic query to fetch concepts, content and document.
// Arguments are as in getConcepts, except we use numeric db ids of concepts for schemas instead
// their respective content's source_local_id.
const composeConceptQuery = ({
  supabase,
  spaceId,
  baseNodeLocalIds = [],
  schemaDbIds = 0,
  fetchNodes = true,
  nodeAuthor = undefined,
  inRelsOfType = undefined,
  inRelsToNodesOfType = undefined,
  inRelsToNodesOfAuthor = undefined,
  inRelsToNodeLocalIds = undefined,
  conceptFields = ["id", "name", "space_id"],
  contentFields = ["source_local_id"],
  documentFields = [],
  relationFields = undefined,
  relationSubNodesFields = undefined,
  limit = 100,
  offset = 0,
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  schemaDbIds?: number | number[];
  baseNodeLocalIds?: string[];
  fetchNodes?: boolean | null;
  nodeAuthor?: string;
  inRelsOfType?: number[];
  relationSubNodesFields?: (keyof Concept)[];
  inRelsToNodesOfType?: number[];
  inRelsToNodesOfAuthor?: string;
  conceptFields?: (keyof Concept)[];
  contentFields?: (keyof Content)[];
  documentFields?: (keyof Document)[];
  relationFields?: (keyof Concept)[];
  inRelsToNodeLocalIds?: string[];
  limit?: number;
  offset?: number;
}) => {
  let q = conceptFields.join(",\n");
  const innerContent = schemaDbIds === 0 || baseNodeLocalIds.length > 0;
  if (innerContent && !contentFields.includes("source_local_id")) {
    contentFields = contentFields.slice();
    contentFields.push("source_local_id");
  }
  if (contentFields.length > 0) {
    const args: string[] = contentFields.slice();
    if (documentFields.length > 0) {
      args.push(
        `Document:my_documents!document_id${innerContent ? "!inner" : ""} (\n${documentFields.join(",\n")})`,
      );
    }
    q += `,\nContent:my_contents!represented_by_id${innerContent ? "!inner" : ""} (\n${args.join(",\n")})`;
  }
  if (nodeAuthor !== undefined) {
    q += ", author:my_accounts!author_id!inner(account_local_id)";
  }
  if (
    inRelsOfType !== undefined ||
    inRelsToNodesOfType !== undefined ||
    inRelsToNodesOfAuthor !== undefined ||
    inRelsToNodeLocalIds !== undefined
  ) {
    const args: string[] = (relationFields || []).slice();
    if (inRelsOfType !== undefined && !args.includes("schema_id"))
      args.push("schema_id");
    if (
      inRelsToNodesOfType !== undefined ||
      inRelsToNodesOfAuthor !== undefined ||
      inRelsToNodeLocalIds !== undefined
    ) {
      const args2: string[] = (relationSubNodesFields || []).slice();
      if (inRelsToNodesOfType !== undefined && !args2.includes("schema_id"))
        args2.push("schema_id");
      if (inRelsToNodeLocalIds !== undefined)
        args2.push(
          "Content:my_contents!represented_by_id!inner(source_local_id)",
        );
      if (inRelsToNodesOfAuthor !== undefined) {
        if (!args2.includes("author_id")) args2.push("author_id");
        args2.push("author:my_accounts!author_id!inner(account_local_id)");
      }
      args.push(`subnodes:concepts_of_relation!inner(${args2.join(",\n")})`);
    }
    q += `, relations:concept_in_relations!inner(${args.join(",\n")})`;
  }
  let query = supabase.from("my_concepts").select(q);
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
  if (baseNodeLocalIds.length > 0)
    query = query.in("Content.source_local_id", baseNodeLocalIds);
  if (inRelsOfType !== undefined && inRelsOfType.length > 0)
    query = query.in("relations.schema_id", inRelsOfType);
  if (inRelsToNodesOfType !== undefined && inRelsToNodesOfType.length > 0)
    query = query.in("relations.subnodes.schema_id", inRelsToNodesOfType);
  if (inRelsToNodesOfAuthor !== undefined) {
    query = query.eq(
      "relations.subnodes.author.account_local_id",
      inRelsToNodesOfAuthor,
    );
  }
  if (inRelsToNodeLocalIds !== undefined) {
    query = query.in(
      "relations.subnodes.Content.source_local_id",
      inRelsToNodeLocalIds,
    );
  }
  if (limit > 0 || offset > 0) {
    query = query.order("id");
    if (offset > 0) {
      limit = Math.min(limit, 1000);
      query = query.range(offset, offset + limit);
    } else if (limit > 0) {
      query = query.limit(limit);
    }
  }
  // console.debug(query);
  return query;
};

// Obtain basic data for all node schemas in a space, populating the cache.
export const getSchemaConcepts = async (
  supabase: DGSupabaseClient,
  spaceId: number,
  forceCacheReload: boolean = false,
): Promise<NodeSignature[]> => {
  let result = Object.values(NODE_SCHEMA_CACHE)
    .filter((x) => typeof x === "object")
    .filter((x) => x.spaceId === spaceId || x.spaceId === 0);
  if (forceCacheReload || result.length === 1) {
    const q = composeConceptQuery({ supabase, spaceId, fetchNodes: null });
    const res = (await q) as PostgrestResponse<DefaultQueryShape>;
    if (res.error) {
      console.error("getSchemaConcepts failed", res.error);
      return [NODE_SCHEMA_CACHE[NODE_SCHEMAS] as NodeSignature];
    }
    Object.assign(
      NODE_SCHEMA_CACHE,
      Object.fromEntries(
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
    );
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
    partialResult.filter(([, v]) => typeof v === "number"),
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
    let q = composeConceptQuery({ supabase, spaceId, fetchNodes: null });
    if (Object.keys(NODE_SCHEMA_CACHE).length > 1) {
      // Non-empty cache, query selectively
      q = q
        .in("Content.source_local_id", localLocalIds)
        .not("Content.source_local_id", "is", null);
    } // otherwise populate the cache
    const res = (await q) as PostgrestResponse<DefaultQueryShape>;
    if (res.error) {
      console.error("could not get db Ids", res.error);
      return dbIds;
    }
    Object.assign(
      NODE_SCHEMA_CACHE,
      Object.fromEntries(
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
    );
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

// instrumentation for benchmarking
export const LAST_QUERY_DATA = { duration: 0 };

// Main entry point to query Concepts and related data:
// related sub-objects can be provided as:
// Content, Content.Document, author (PlatformAccount), relations (Concept),
// relations.subnodes (Concept), relations.subnodes.author, relations.subnodes.Content
// Which fields of these subobjects are fetched is controlled by the respective Fields parameters
// (except the last two, which would have just enough data for query filters.)
// If the fields are empty, the sub-object will not be fetched (unless needed for matching query parameters)
// Any parameter called "local" expects platform Ids (source_local_id) of the corresponding Content.
// In the case of node/relation definitions, schema refers to the page Id of the definition.
export const getConcepts = async ({
  supabase, // An instance of a logged-in client
  spaceId, // the numeric id of the space being queried
  baseNodeLocalIds = [], // If we are specifying the Concepts being queried directly.
  schemaLocalIds = NODE_SCHEMAS, // the type of Concepts being queried
  // • ALL schemas:              schemaLocalIds = NODE_SCHEMAS (default, "__schemas")
  // • ALL instances (nodes and/or relations):    schemaLocalIds = []
  // • Nodes from X,Y schemas:   schemaLocalIds = ["localIdX","localIdY",...]
  fetchNodes = true, // are we fetching nodes or relations?
  //  true for nodes, false for relations, null for both
  nodeAuthor = undefined, // filter on Content author
  inRelsOfTypeLocal = undefined, // filter on Concepts that participate in a relation of a given type
  inRelsToNodesOfTypeLocal = undefined, // filter on Concepts that are in a relation with another node of a given type
  inRelsToNodesOfAuthor = undefined, // filter on Concepts that are in a relation with another Concept by a given author
  inRelsToNodeLocalIds = undefined, // filter on Concepts that are in relation with a Concept from a given list
  conceptFields = CONCEPT_FIELDS, // which fields are returned for the given Concept
  contentFields = CONTENT_FIELDS, // which fields are returned for the corresponding Content
  documentFields = DOCUMENT_FIELDS, // which fields are returned for the Content's corresponding Document
  relationFields = undefined, // which fields are returned for the relation the node is part of
  relationSubNodesFields = undefined, // which fields are returned for the other nodes in the relation the target node is part of
  limit = 100, // query limit
  offset = 0, // query offset
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  baseNodeLocalIds?: string[];
  schemaLocalIds?: string | string[];
  fetchNodes?: boolean | null;
  nodeAuthor?: string;
  inRelsOfTypeLocal?: string[];
  inRelsToNodesOfTypeLocal?: string[];
  inRelsToNodesOfAuthor?: string;
  inRelsToNodeLocalIds?: string[];
  conceptFields?: (keyof Concept)[];
  contentFields?: (keyof Content)[];
  documentFields?: (keyof Document)[];
  relationFields?: (keyof Concept)[];
  relationSubNodesFields?: (keyof Concept)[];
  limit?: number;
  offset?: number;
}): Promise<PConceptFull[]> => {
  const schemaLocalIdsArray =
    typeof schemaLocalIds === "string" ? [schemaLocalIds] : schemaLocalIds;
  // translate schema local content Ids to concept database Ids.
  const localIds = new Set<string>(schemaLocalIdsArray);
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

  const q = composeConceptQuery({
    supabase,
    spaceId,
    baseNodeLocalIds,
    schemaDbIds,
    conceptFields,
    contentFields,
    documentFields,
    nodeAuthor,
    fetchNodes,
    inRelsOfType: localToDbArray(inRelsOfTypeLocal),
    relationFields,
    relationSubNodesFields,
    inRelsToNodesOfType: localToDbArray(inRelsToNodesOfTypeLocal),
    inRelsToNodesOfAuthor,
    inRelsToNodeLocalIds,
    limit,
    offset,
  });
  const before = Date.now();
  const { error, data } = (await q) as PostgrestResponse<PConceptFull>;
  LAST_QUERY_DATA.duration = Date.now() - before;
  // benchmarking
  // console.debug(LAST_QUERY_DATA.duration, q);

  if (error) {
    console.error("getConcepts failed", error);
    return [];
  }
  return data || [];
};
