import { PostgrestResponse } from "@supabase/supabase-js";
import type { Tables } from "../dbTypes";
import { DGSupabaseClient } from "./client";

// Query API Overview:
//
// - getConcepts(): Generic API which handles many combinations of filters
// - Single-filter functions: getAllNodes, getNodesByType, getAllRelations, etc.
//   Helps understand each filter in isolation.
// - Always includes metadata (created/edited user/times) by default
//
// Examples:
//
// // Query all nodes of a specific type
// const nodes = await getNodesByType({
//   supabase, spaceId, ofTypes: ["my-node-type"]
// });
//
// // Query nodes of specific types and their (filtered) relations
// const nodes = await getNodesOfTypeWithRelations({
//   supabase, spaceId, ofTypes: ["claim"], relationTypes: ["cites", "references"]
// });
//
// // Get discourse context (all nodes connected to a node or set of nodes)
// const context = await getDiscourseContext({
//   supabase, spaceId, nodeIds: ["node-123"]
// });
//
// // Use the main getConcepts function for complex queries
// const results = await getConcepts({
//   supabase, spaceId,
//   scope: { type: 'nodes', ofTypes: ['type1', 'type2'] },
//   relations: { ofTypes: ['cites'], author: 'user123' },
//   author: 'creator456',
//   pagination: { limit: 50, offset: 0 }
// });

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
// Cache of nodes keyed by sourceLocalId
// TODO: Consider including the source_id in the key to avoid collisions
// I see a case for shared Ids, but this is not handled well here either.
const NODE_SCHEMA_CACHE: Record<string, CacheEntry> = {
  [NODE_SCHEMAS]: nodeSchemaSignature,
};

export const initNodeSchemaCache = () => {
  Object.keys(NODE_SCHEMA_CACHE).forEach((k) => {
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

/**
 * Defines what type of concepts to query and any specific constraints.
 *
 * @example
 * ```typescript
 * // Query all nodes of specific types
 * { type: "nodes", ofTypes: ["page", "note"] }
 *
 * // Query all relations
 * { type: "relations" }
 *
 * // Query specific nodes by their local IDs
 * { type: "nodes", nodeIds: ["node-123", "node-456"] }
 *
 * // Query relation schemas
 * { type: "relations", schemas: true }
 * ```
 */
export type NodeFilters = {
  /** The type of concept frames to retrieve */
  type: "all" | "nodes" | "relations";
  /* Whether we are retrieving schemas or instances */
  schemas?: boolean;
  /**
   * Retrieve instances of those types (aka schemas) only.
   * Given as a list of local Ids (eg Roam page Ids of the node or relation types)
   * Only used when schemas=false.
   */
  ofTypes?: string[];
  /**
   * Specific node local IDs to retrieve.
   */
  nodeIds?: string[];

  /** Filter results by the author who created the concepts. Use the local Id for the author. */
  author?: string;
};

type NodeFiltersDb = Omit<NodeFilters, "ofTypes"> & { ofTypes?: number[]};


/**
 * Filters for querying concepts based on their relationships.
 * All filters are optional and can be combined.
 *
 * @example
 * ```typescript
 * // Find relations of type "cites" containing specific nodes
 * {
 *   ofTypes: ["cites", "references"],
 *   toNodeIds: ["node-123", "node-456"]
 * }
 *
 * // Find concepts connected to nodes of specific types
 * {
 *   toNodeTypes: ["page", "note"]
 * }
 * ```
 */
export type RelationFilters = {
  /** Find relations containing any of these nodes (multiple nodes) */
  /* SLOW. Avoid using unless you have strong constraints on base node of search */
  toNodeIds?: string[];
  /** Find concepts participating in relations of these types */
  ofTypes?: string[];
  /** Find concepts connected to nodes of these types. */
  toNodeTypes?: string[];
  /** Find concepts in relations authored by this user */
  /* SLOW. Avoid using unless you have strong constraints on base node of search */
  author?: string;
};

export type RelationFiltersDb = Omit<RelationFilters, "ofTypes"|"toNodeTypes">&{ofTypes?: number[], toNodeTypes?: number[]};

/**
 * Controls which fields are returned in the response.
 * Each field array specifies which columns to fetch from the respective table.
 * If a field array is empty or undefined, that data won't be fetched.
 *
 * @example
 * ```typescript
 * // Get minimal concept data with full content
 * {
 *   concepts: ["id", "name", "created"],
 *   content: ["source_local_id", "text", "metadata"]
 * }
 * ```
 */
export type FieldSelection = {
  /** Fields to return from the Concept table */
  concepts?: (keyof Concept)[];
  /** Fields to return from the Content table */
  content?: (keyof Content)[];
  /** Fields to return from the Document table */
  documents?: (keyof Document)[];
  /** Fields to return for relation concepts */
  relations?: (keyof Concept)[];
  /** Fields to return for nodes in relations */
  relationNodes?: (keyof Concept)[];
};

/**
 * Pagination options for controlling result set size and offset.
 *
 * @example
 * ```typescript
 * // Get first 50 results
 * { limit: 50 }
 *
 * // Get next 50 results (pagination)
 * { limit: 50, offset: 50 }
 * ```
 */
export type PaginationOptions = {
  /** Maximum number of results to return (default: 100) */
  limit?: number;
  /** Number of results to skip (default: 0) */
  offset?: number;
};

/**
 * Main parameters for querying concepts with the new grouped API.
 * Provides better developer experience with logical parameter grouping.
 *
 * @example
 * ```typescript
 * const results = await getConcepts({
 *   supabase,
 *   spaceId: 123,
 *   scope: { type: "nodes", ofTypes: ["page"] },
 *   relations: { ofTypes: ["cites"] },
 *   author: "user123",
 *   pagination: { limit: 50 }
 * });
 * ```
 */
export type GetConceptsParams = {
  /** Supabase client instance (must be authenticated) */
  supabase: DGSupabaseClient;
  /** Space ID to query within (optional, uses client's default space) */
  spaceId?: number;

  /** What type of concepts to query and any constraints */
  scope?: NodeFilters;

  /** Optional filters based on relationships */
  relations?: RelationFilters;

  /** Control which fields are returned in the response */
  fields?: FieldSelection;

  /** Pagination options for result set control */
  pagination?: PaginationOptions;
};

type GetConceptsParamsDb = Omit<GetConceptsParams, "scope"|"relations">&{scope?: NodeFiltersDb, relations?: RelationFiltersDb};

// Utility function to compose a generic query to fetch concepts, content and document.
// Arguments are as in getConcepts, except we use numeric db ids of concepts for schemas instead
// their respective content's source_local_id.
const composeConceptQuery = ({
  supabase,
  spaceId,
  scope= {
    type: "nodes",
  },
  relations= {},
  fields= {
    concepts: ["id", "name", "space_id"],
    content: ["source_local_id"],
  },
  pagination= {
    offset: 0,
    limit: 100,
  },
}: GetConceptsParamsDb) => {
  const baseNodeLocalIds = scope.nodeIds || [];
  const inRelsOfType = relations.ofTypes;
  const inRelsToNodesOfType = relations.toNodeTypes;
  const inRelsToNodeLocalIds = relations.toNodeIds;
  const inRelsToNodesOfAuthor = relations.author;

  let q = (fields.concepts || CONCEPT_FIELDS).join(",\n");
  const innerContent = scope.schemas || baseNodeLocalIds.length > 0;
  const ctArgs: string[] = (fields.content || []).slice();
  if (innerContent && !ctArgs.includes("source_local_id")) {
    ctArgs.push("source_local_id");
  }
  if (ctArgs.length > 0) {
    const documentFields = fields.documents || [];
    if (documentFields.length > 0) {
      ctArgs.push(`Document:my_documents!document_id${innerContent ? "!inner" : ""} (\n ${documentFields.join(",\n")} )`);
    }
    q += `,\nContent:my_contents!represented_by_id${innerContent ? "!inner" : ""} (\n${ctArgs.join(",\n")})`;
  }
  if (scope.author !== undefined) {
    q += ", author:my_accounts!author_id!inner(account_local_id)";
  }
  if (
    inRelsOfType !== undefined ||
    inRelsToNodesOfType !== undefined ||
    inRelsToNodesOfAuthor !== undefined ||
    inRelsToNodeLocalIds !== undefined
  ) {
    const args: string[] = (fields.relations || []).slice();
    if (inRelsOfType !== undefined && !args.includes("schema_id"))
      args.push("schema_id");
    if (
      inRelsToNodesOfType !== undefined ||
      inRelsToNodesOfAuthor !== undefined ||
      inRelsToNodeLocalIds !== undefined
    ) {
      const args2: string[] = (fields.relationNodes || []).slice();
      if (inRelsToNodesOfType !== undefined && !args2.includes("schema_id"))
        args2.push("schema_id");
      if (inRelsToNodeLocalIds !== undefined)
        args2.push("Content:my_contents!represented_by_id!inner(source_local_id)");
      if (inRelsToNodesOfAuthor !== undefined) {
        if (!args2.includes("author_id")) args2.push("author_id");
        args2.push("author:my_accounts!author_id!inner(account_local_id)");
      }
      args.push(`subnodes:concepts_of_relation!inner(${args2.join(",\n")})`);
    }
    q += `, relations:concept_in_relations!inner(${args.join(",\n")})`;
  }
  let query = supabase.from("my_concepts").select(q);
  if (scope.type === "nodes") {
    query = query.eq("arity", 0);
  } else if (scope.type === 'relations') {
    query = query.gt("arity", 0);
  }
  // else fetch both

  if (spaceId !== undefined) query = query.eq("space_id", spaceId);
  if (scope.author !== undefined) {
    query = query.eq("author.account_local_id", scope.author);
  }
  if (scope.schemas) {
    query = query.eq("is_schema", true);
  } else {
    query = query.eq("is_schema", false);
    const schemaDbIds = scope.ofTypes || [];
    if (schemaDbIds.length > 0) {
      if (schemaDbIds.length === 1)
        query = query.eq("schema_id", schemaDbIds[0]!);
      else
        query = query.in("schema_id", schemaDbIds);
    }
    // else we'll get all nodes
  }
  if (baseNodeLocalIds.length > 0) {
    if (baseNodeLocalIds.length === 1)
      query = query.eq("Content.source_local_id", baseNodeLocalIds[0]!);
    else
      query = query.in("Content.source_local_id", baseNodeLocalIds);
  }
  if (inRelsOfType !== undefined && inRelsOfType.length > 0) {
    if (inRelsOfType.length === 1)
      query = query.eq("relations.schema_id", inRelsOfType[0]!);
    else
      query = query.in("relations.schema_id", inRelsOfType);
  }
  if (inRelsToNodesOfType !== undefined && inRelsToNodesOfType.length > 0) {
    if (inRelsToNodesOfType.length === 1)
      query = query.eq("relations.subnodes.schema_id", inRelsToNodesOfType[0]!);
    else
      query = query.in("relations.subnodes.schema_id", inRelsToNodesOfType);
  }
  if (inRelsToNodesOfAuthor !== undefined) {
    query = query.eq(
      "relations.subnodes.author.account_local_id",
      inRelsToNodesOfAuthor,
    );
  }
  if (inRelsToNodeLocalIds !== undefined && inRelsToNodeLocalIds.length > 0) {
    if (inRelsToNodeLocalIds.length === 1)
      query = query.eq(
        "relations.subnodes.Content.source_local_id",
        inRelsToNodeLocalIds[0]!,
      );
    else
      query = query.in(
        "relations.subnodes.Content.source_local_id",
        inRelsToNodeLocalIds,
      );
  }
  const limit = Math.min(pagination.limit || 100, 1000);
  const offset = pagination.offset || 0;
  if (limit > 0 || offset > 0) {
    query = query.order("id");
    if (offset > 0) {
      const to = Math.max(offset, offset + limit - 1);
      query = query.range(offset, to);
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
    const q = composeConceptQuery({ supabase, spaceId, scope: {type:"all", schemas: true} });
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
    let q = composeConceptQuery({ supabase, spaceId, scope: {type:"all", schemas: true} });
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

/**
 * Minimal concept fields for lightweight queries.
 * Includes only essential fields: id, name, space_id, author_id, created, last_modified.
 *
 * @example
 * ```typescript
 * // Use minimal fields for performance
 * const nodes = await getAllNodes({
 *   supabase,
 *   fields: { concepts: CONCEPT_FIELDS_MINIMAL }
 * });
 * ```
 */
export const CONCEPT_FIELDS_MINIMAL: (keyof Concept)[] = [
  "id",
  "name",
  "space_id",
  "author_id",
  "created",
  "last_modified",
];

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

// Primitive query functions for common use cases
// These provide a simpler API for the most common query patterns

/**
 * Retrieves all discourse nodes (non-relation concepts) in a space.
 *
 * @param params - Query parameters
 * @param params.supabase - Authenticated Supabase client
 * @param params.spaceId - Space ID to query (optional)
 * @param params.author - Filter by author (optional)
 * @param params.fields - Fields to return (defaults to full concept + content)
 * @param params.pagination - Pagination options (defaults to limit 100)
 * @returns Promise resolving to array of concept objects with full metadata
 *
 * @example
 * ```typescript
 * // Get all nodes in the space
 * const allNodes = await getAllNodes({ supabase, spaceId: 123 });
 *
 * // Get nodes by a specific author
 * const myNodes = await getAllNodes({
 *   supabase,
 *   spaceId: 123,
 *   author: "user123"
 * });
 * ```
 */
export const getAllNodes = async ({
  supabase,
  spaceId,
  author,
  ofTypes,
  fields = { concepts: CONCEPT_FIELDS, content: CONTENT_FIELDS },
  pagination,
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  author?: string;
  ofTypes?: string[];
  fields?: FieldSelection;
  pagination?: PaginationOptions;
}): Promise<PConceptFull[]> => {
  return getConcepts({
    supabase,
    spaceId,
    scope: { type: "nodes", author, ofTypes },
    fields,
    pagination,
  });
};

/**
 * Retrieves all discourse nodes of specific types.
 *
 * @param params - Query parameters
 * @param params.supabase - Authenticated Supabase client
 * @param params.spaceId - Space ID to query (optional)
 * @param params.nodeTypes - Array of node type local IDs to filter by
 * @param params.author - Filter by author (optional)
 * @param params.fields - Fields to return (defaults to full concept + content)
 * @param params.pagination - Pagination options (defaults to limit 100)
 * @returns Promise resolving to array of concept objects with full metadata
 *
 * @example
 * ```typescript
 * // Get all pages and notes
 * const nodes = await getNodesByType({
 *   supabase,
 *   spaceId: 123,
 *   ofTypes: ["page", "note"]
 * });
 *
 * // Get pages by a specific author
 * const myPages = await getNodesByType({
 *   supabase,
 *   spaceId: 123,
 *   ofTypes: ["page"],
 *   author: "user123"
 * });
 * ```
 */
export const getNodesByType = async ({
  supabase,
  spaceId,
  ofTypes,
  author,
  fields = { concepts: CONCEPT_FIELDS, content: CONTENT_FIELDS },
  pagination,
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  ofTypes: string[];
  author?: string;
  fields?: FieldSelection;
  pagination?: PaginationOptions;
}): Promise<PConceptFull[]> => {
  return getConcepts({
    supabase,
    spaceId,
    scope: { type: "nodes", ofTypes, author },
    fields,
    pagination,
  });
};

/**
 * Retrieves all discourse relations (concepts with arity > 0) in a space.
 *
 * @param params - Query parameters
 * @param params.supabase - Authenticated Supabase client
 * @param params.spaceId - Space ID to query (optional)
 * @param params.author - Filter by author (optional)
 * @param params.fields - Fields to return (defaults to full concept + content)
 * @param params.pagination - Pagination options (defaults to limit 100)
 * @returns Promise resolving to array of relation concept objects with full metadata
 *
 * @example
 * ```typescript
 * // Get all relations in the space
 * const relations = await getAllRelations({ supabase, spaceId: 123 });
 *
 * // Get relations by a specific author
 * const myRelations = await getAllRelations({
 *   supabase,
 *   spaceId: 123,
 *   author: "user123"
 * });
 * ```
 */
export const getAllRelations = async ({
  supabase,
  spaceId,
  author,
  fields = { concepts: CONCEPT_FIELDS, content: CONTENT_FIELDS },
  pagination,
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  author?: string;
  fields?: FieldSelection;
  pagination?: PaginationOptions;
}): Promise<PConceptFull[]> => {
  return getConcepts({
    supabase,
    spaceId,
    scope: { type: "relations", author },
    fields,
    pagination,
  });
};

/**
 * Retrieves all relations that start from nodes of specific types. Centered on the node.
 *
 * @param params - Query parameters
 * @param params.supabase - Authenticated Supabase client
 * @param params.spaceId - Space ID to query (optional)
 * @param params.ofTypes - Array of node type local IDs in the relation
 * @param params.relationTypes - Optional array of relation types to filter by
 * @param params.nodeAuthoredBy - Optional filter by target node author (SLOW)
 * @param params.fields - Fields to return (defaults to full concept + content)
 * @param params.pagination - Pagination options (defaults to limit 100)
 * @returns Promise resolving to array of relation concept objects
 *
 * @example
 * ```typescript
 * // Find all relations containing page nodes
 * const relations = await getNodesOfTypeWithRelations({
 *   supabase,
 *   spaceId: 123,
 *   ofTypes: ["page"]
 * });
 *
 * // Find citation relations containing note nodes
 * const citations = await getNodesOfTypeWithRelations({
 *   supabase,
 *   spaceId: 123,
 *   ofTypes: ["note"],
 *   relationTypes: ["cites"]
 * });
 * ```
 */
export const getNodesOfTypeWithRelations = async ({
  supabase,
  spaceId,
  ofTypes,
  relationTypes,
  nodeAuthoredBy,
  fields = { concepts: CONCEPT_FIELDS, content: CONTENT_FIELDS },
  pagination,
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  ofTypes: string[];
  relationTypes?: string[];
  nodeAuthoredBy?: string;
  fields?: FieldSelection;
  pagination?: PaginationOptions;
}): Promise<PConceptFull[]> => {
  return getConcepts({
    supabase,
    spaceId,
    scope: { type:"nodes", ofTypes, }, // we still start from the node
    relations: {
      ofTypes: relationTypes,
      author: nodeAuthoredBy,
    },
    fields,
    pagination,
  });
};

/**
 * Retrieves the discourse context of a set of nodes - all nodes and relations connected to it.
 * This is useful for understanding the full context around a specific concept.
 *
 * @param params - Query parameters
 * @param params.supabase - Authenticated Supabase client
 * @param params.spaceId - Space ID to query (optional)
 * @param params.nodeIds - Local ID of the nodes to get context for
 * @param params.fields - Fields to return (defaults to full concept + content + minimal relations)
 * @param params.pagination - Pagination options (defaults to limit 100)
 * @returns Promise resolving to array of concept objects including relations
 *
 * @example
 * ```typescript
 * // Get full context around a node
 * const context = await getDiscourseContext({
 *   supabase,
 *   spaceId: 123,
 *   nodeIds: ["node-123"]
 * });
 *
 * // The result will include:
 * // - The target node itself
 * // - All nodes connected to it via relations
 * // - The relation information connecting them
 * ```
 */
export const getDiscourseContext = async ({
  supabase,
  spaceId,
  nodeIds,
  fields = {
    concepts: CONCEPT_FIELDS,
    content: CONTENT_FIELDS,
    relations: CONCEPT_FIELDS_MINIMAL,
    relationNodes: CONCEPT_FIELDS_MINIMAL,
  },
  pagination,
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  nodeIds: string[];
  fields?: FieldSelection;
  pagination?: PaginationOptions;
}): Promise<PConceptFull[]> => {
  return getConcepts({
    supabase,
    spaceId,
    scope: { type: "all", nodeIds },
    fields,
    pagination,
  });
};


// instrumentation for benchmarking
export const LAST_QUERY_DATA = { duration: 0 };

/**
 * Main entry point to query Concepts and related data:
 * related sub-objects can be provided as:
 * Content, Content.Document, author (PlatformAccount), relations (Concept),
 * relations.subnodes (Concept), relations.subnodes.author, relations.subnodes.Content
 * Which fields of these subobjects are fetched is controlled by the fields sub-parameters
 * (except the last two, which would have just enough data for query filters.)
 * If the fields are empty, the sub-object will not be fetched (unless needed for matching query parameters)
 * Node identifiers are platform Ids (source_local_id) of the corresponding Content.
 * In the case of node/relation definitions, schema refers to the page Id of the definition.
 * Author identifiers are also source local ids.
 *
 * @param params - Query parameters with grouped structure
 * @returns Promise resolving to array of concept objects with full metadata
 *
 * @example
 * ```typescript
 * // Query nodes of specific types with relation filters
 * const results = await getConcepts({
 *   supabase,
 *   spaceId: 123,
 *   scope: { type: "nodes", ofTypes: ["pageId", "noteId"], author: "user123Id" },
 *   relations: { ofTypes: ["citesId", "referencesId"] },
 *   pagination: { limit: 50, offset: 0 }
 * });
 *
 * // Query relations from specific nodes
 * const relations = await getConcepts({
 *   supabase,
 *   spaceId: 123,
 *   scope: { type: "nodes", nodeIds: ["node-123", "node-456"] },
 *   fields: { relations: CONCEPT_FIELDS_MINIMAL, relationNodes: CONCEPT_FIELDS_MINIMAL }
 * });
 *
 * // Query relations linking specific nodes
 * const relations = await getConcepts({
 *   supabase,
 *   spaceId: 123,
 *   scope: { type: "nodes", nodeIds: ["node-123", "node-456"] },
 *   relations: { toNodeIds: ["node-789"] }
 * });
 * ```
 */
export const getConcepts = async (
  {
    supabase,
    spaceId,
    scope= {
      type: "nodes",
    },
    relations= {},
    fields= {
      concepts: CONCEPT_FIELDS,
      content: CONTENT_FIELDS,
      documents: DOCUMENT_FIELDS
    },
    pagination= {
      offset: 0,
      limit: 100,
    },
  }: GetConceptsParams
): Promise<PConceptFull[]> => {
  // translate schema local content Ids to concept database Ids.
  const localSchemaIds = new Set<string>();
  (scope.ofTypes || []).map((k) => localSchemaIds.add(k));
  (relations.ofTypes || []).map((k) => localSchemaIds.add(k));
  (relations.toNodeTypes || []).map((k) => localSchemaIds.add(k));
  const dbIdsMapping = await getLocalToDbIdMapping(
    supabase,
    new Array(...localSchemaIds.keys()),
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
  const q = composeConceptQuery({
    supabase,
    spaceId,
    scope: {
      ...scope,
      ofTypes: localToDbArray(scope.ofTypes)
    },
    relations: {
      ...relations,
      ofTypes: localToDbArray(relations.ofTypes),
      toNodeTypes: localToDbArray(relations.toNodeTypes)
    },
    fields,
    pagination
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
