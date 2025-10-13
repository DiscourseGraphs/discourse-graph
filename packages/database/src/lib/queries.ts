import { PostgrestResponse } from "@supabase/supabase-js";
import type { Tables } from "../dbTypes";
import { DGSupabaseClient } from "./client";

// Query API Overview:
//
// NEW API (Recommended):
// - getConcepts(): Main function with grouped parameters for better DX
// - Primitive functions: getAllNodes, getNodesByType, getAllRelations, etc.
// - Always includes metadata (created/edited user/times) by default
//
// LEGACY API (Backward compatibility):
// - getConceptsLegacy(): Original function with 17 parameters
//
// Examples:
//
// // Query all nodes of a specific type
// const nodes = await getNodesByType({
//   supabase, spaceId, nodeTypes: ["my-node-type"]
// });
//
// // Query all relations containing a specific node
// const relations = await getRelationsContainingNode({
//   supabase, spaceId, nodeIds: ["node-123"]
// });
//
// // Query nodes in relations of specific types
// const nodes = await getNodesInRelations({
//   supabase, spaceId, relationTypes: ["cites", "references"]
// });
//
// // Get discourse context (all nodes connected to a node)
// const context = await getDiscourseContext({
//   supabase, spaceId, nodeId: "node-123"
// });
//
// // Use the main getConcepts function for complex queries
// const results = await getConcepts({
//   supabase, spaceId,
//   scope: { type: 'nodes', nodeTypes: ['type1', 'type2'] },
//   relations: { ofType: ['cites'], authoredBy: 'user123' },
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

/**
 * Default concept fields that include metadata (created/edited user and times).
 * These fields are returned by default for all queries unless overridden.
 *
 * @example
 * ```typescript
 * // Use default fields
 * const nodes = await getAllNodes({ supabase });
 *
 * // Override with custom fields
 * const nodes = await getAllNodes({
 *   supabase,
 *   fields: { concepts: CONCEPT_FIELDS_MINIMAL }
 * });
 * ```
 */
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

/**
 * Defines what type of concepts to query and any specific constraints.
 *
 * @example
 * ```typescript
 * // Query all nodes of specific types
 * { type: "nodes", nodeTypes: ["page", "note"] }
 *
 * // Query all relations
 * { type: "relations" }
 *
 * // Query specific nodes by their local IDs
 * { type: "specific", nodeIds: ["node-123", "node-456"] }
 * ```
 */
export type QueryScope = {
  /** The type of concepts to retrieve */
  type: "all" | "nodes" | "relations" | "schemas" | "specific";
  /**
   * Schema local IDs to filter by (e.g., ["page", "note", "relation"]).
   * Only used when type is "nodes" or "relations".
   */
  nodeTypes?: string[];
  /**
   * Specific node local IDs to retrieve.
   * Only used when type is "specific".
   */
  nodeIds?: string[];
};

/**
 * Filters for querying concepts based on their relationships.
 * All filters are optional and can be combined.
 *
 * @example
 * ```typescript
 * // Find relations of type "cites" containing specific nodes
 * {
 *   ofType: ["cites", "references"],
 *   containingNodes: ["node-123", "node-456"]
 * }
 *
 * // Find concepts connected to nodes of specific types
 * {
 *   toNodeTypes: ["page", "note"]
 * }
 * ```
 */
export type RelationFilters = {
  /** Find relations containing this specific node (single node) */
  containingNode?: string;
  /** Find relations containing any of these nodes (multiple nodes) */
  containingNodes?: string[];
  /** Find concepts participating in relations of these types */
  ofType?: string[];
  /** Find concepts connected to nodes of these types */
  toNodeTypes?: string[];
  /** Find concepts in relations authored by this user */
  authoredBy?: string;
};

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
 *   scope: { type: "nodes", nodeTypes: ["page"] },
 *   relations: { ofType: ["cites"] },
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
  scope: QueryScope;

  /** Optional filters based on relationships */
  relations?: RelationFilters;

  /** Filter results by the author who created the concepts */
  author?: string;

  /** Control which fields are returned in the response */
  fields?: FieldSelection;

  /** Pagination options for result set control */
  pagination?: PaginationOptions;
};

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
  fields = { concepts: CONCEPT_FIELDS, content: CONTENT_FIELDS },
  pagination = { limit: 100 },
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  author?: string;
  fields?: FieldSelection;
  pagination?: PaginationOptions;
}): Promise<PConceptFull[]> => {
  return getConceptsNew({
    supabase,
    spaceId,
    scope: { type: "nodes" },
    author,
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
 *   nodeTypes: ["page", "note"]
 * });
 *
 * // Get pages by a specific author
 * const myPages = await getNodesByType({
 *   supabase,
 *   spaceId: 123,
 *   nodeTypes: ["page"],
 *   author: "user123"
 * });
 * ```
 */
export const getNodesByType = async ({
  supabase,
  spaceId,
  nodeTypes,
  author,
  fields = { concepts: CONCEPT_FIELDS, content: CONTENT_FIELDS },
  pagination = { limit: 100 },
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  nodeTypes: string[];
  author?: string;
  fields?: FieldSelection;
  pagination?: PaginationOptions;
}): Promise<PConceptFull[]> => {
  return getConceptsNew({
    supabase,
    spaceId,
    scope: { type: "nodes", nodeTypes },
    author,
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
  pagination = { limit: 100 },
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  author?: string;
  fields?: FieldSelection;
  pagination?: PaginationOptions;
}): Promise<PConceptFull[]> => {
  return getConceptsNew({
    supabase,
    spaceId,
    scope: { type: "relations" },
    author,
    fields,
    pagination,
  });
};

/**
 * Retrieves all relations that contain nodes of specific types.
 *
 * @param params - Query parameters
 * @param params.supabase - Authenticated Supabase client
 * @param params.spaceId - Space ID to query (optional)
 * @param params.nodeTypes - Array of node type local IDs that must be in the relations
 * @param params.relationTypes - Optional array of relation types to filter by
 * @param params.authoredBy - Optional filter by relation author
 * @param params.fields - Fields to return (defaults to full concept + content)
 * @param params.pagination - Pagination options (defaults to limit 100)
 * @returns Promise resolving to array of relation concept objects
 *
 * @example
 * ```typescript
 * // Find all relations containing page nodes
 * const relations = await getRelationsContainingNodeType({
 *   supabase,
 *   spaceId: 123,
 *   nodeTypes: ["page"]
 * });
 *
 * // Find citation relations containing note nodes
 * const citations = await getRelationsContainingNodeType({
 *   supabase,
 *   spaceId: 123,
 *   nodeTypes: ["note"],
 *   relationTypes: ["cites"]
 * });
 * ```
 */
export const getRelationsContainingNodeType = async ({
  supabase,
  spaceId,
  nodeTypes,
  relationTypes,
  authoredBy,
  fields = { concepts: CONCEPT_FIELDS, content: CONTENT_FIELDS },
  pagination = { limit: 100 },
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  nodeTypes: string[];
  relationTypes?: string[];
  authoredBy?: string;
  fields?: FieldSelection;
  pagination?: PaginationOptions;
}): Promise<PConceptFull[]> => {
  return getConceptsNew({
    supabase,
    spaceId,
    scope: { type: "relations" },
    relations: {
      toNodeTypes: nodeTypes,
      ofType: relationTypes,
      authoredBy,
    },
    fields,
    pagination,
  });
};

/**
 * Retrieves all relations that contain specific nodes.
 *
 * @param params - Query parameters
 * @param params.supabase - Authenticated Supabase client
 * @param params.spaceId - Space ID to query (optional)
 * @param params.nodeIds - Array of specific node local IDs that must be in the relations
 * @param params.relationTypes - Optional array of relation types to filter by
 * @param params.authoredBy - Optional filter by relation author
 * @param params.fields - Fields to return (defaults to full concept + content)
 * @param params.pagination - Pagination options (defaults to limit 100)
 * @returns Promise resolving to array of relation concept objects
 *
 * @example
 * ```typescript
 * // Find all relations containing specific nodes
 * const relations = await getRelationsContainingNode({
 *   supabase,
 *   spaceId: 123,
 *   nodeIds: ["node-123", "node-456"]
 * });
 *
 * // Find citation relations containing a specific node
 * const citations = await getRelationsContainingNode({
 *   supabase,
 *   spaceId: 123,
 *   nodeIds: ["node-123"],
 *   relationTypes: ["cites"]
 * });
 * ```
 */
export const getRelationsContainingNode = async ({
  supabase,
  spaceId,
  nodeIds,
  relationTypes,
  authoredBy,
  fields = { concepts: CONCEPT_FIELDS, content: CONTENT_FIELDS },
  pagination = { limit: 100 },
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  nodeIds: string[];
  relationTypes?: string[];
  authoredBy?: string;
  fields?: FieldSelection;
  pagination?: PaginationOptions;
}): Promise<PConceptFull[]> => {
  return getConceptsNew({
    supabase,
    spaceId,
    scope: { type: "relations" },
    relations: {
      containingNodes: nodeIds,
      ofType: relationTypes,
      authoredBy,
    },
    fields,
    pagination,
  });
};

/**
 * Retrieves nodes that participate in relations of specific types.
 *
 * @param params - Query parameters
 * @param params.supabase - Authenticated Supabase client
 * @param params.spaceId - Space ID to query (optional)
 * @param params.relationTypes - Array of relation types to filter by
 * @param params.toNodes - Optional array of node local IDs that must be connected to
 * @param params.authoredBy - Optional filter by relation author
 * @param params.author - Optional filter by node author
 * @param params.fields - Fields to return (defaults to full concept + content)
 * @param params.pagination - Pagination options (defaults to limit 100)
 * @returns Promise resolving to array of node concept objects
 *
 * @example
 * ```typescript
 * // Find all nodes that are cited
 * const citedNodes = await getNodesInRelations({
 *   supabase,
 *   spaceId: 123,
 *   relationTypes: ["cites"]
 * });
 *
 * // Find nodes that cite specific other nodes
 * const citingNodes = await getNodesInRelations({
 *   supabase,
 *   spaceId: 123,
 *   relationTypes: ["cites"],
 *   toNodes: ["node-123", "node-456"]
 * });
 * ```
 */
export const getNodesInRelations = async ({
  supabase,
  spaceId,
  relationTypes,
  toNodes,
  authoredBy,
  author,
  fields = { concepts: CONCEPT_FIELDS, content: CONTENT_FIELDS },
  pagination = { limit: 100 },
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  relationTypes: string[];
  toNodes?: string[];
  authoredBy?: string;
  author?: string;
  fields?: FieldSelection;
  pagination?: PaginationOptions;
}): Promise<PConceptFull[]> => {
  return getConceptsNew({
    supabase,
    spaceId,
    scope: { type: "nodes" },
    relations: {
      ofType: relationTypes,
      containingNodes: toNodes,
      authoredBy,
    },
    author,
    fields,
    pagination,
  });
};

/**
 * Retrieves the discourse context of a node - all nodes and relations connected to it.
 * This is useful for understanding the full context around a specific concept.
 *
 * @param params - Query parameters
 * @param params.supabase - Authenticated Supabase client
 * @param params.spaceId - Space ID to query (optional)
 * @param params.nodeId - Local ID of the node to get context for
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
 *   nodeId: "node-123"
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
  nodeId,
  fields = {
    concepts: CONCEPT_FIELDS,
    content: CONTENT_FIELDS,
    relations: CONCEPT_FIELDS_MINIMAL,
  },
  pagination = { limit: 100 },
}: {
  supabase: DGSupabaseClient;
  spaceId?: number;
  nodeId: string;
  fields?: FieldSelection;
  pagination?: PaginationOptions;
}): Promise<PConceptFull[]> => {
  return getConceptsNew({
    supabase,
    spaceId,
    scope: { type: "all" },
    relations: {
      containingNode: nodeId,
    },
    fields,
    pagination,
  });
};

/**
 * Internal implementation of getConcepts with grouped parameters.
 * Converts the new API to legacy parameters and delegates to getConceptsLegacy.
 *
 * @internal
 */
export const getConceptsNew = async ({
  supabase,
  spaceId,
  scope,
  relations,
  author,
  fields = { concepts: CONCEPT_FIELDS, content: CONTENT_FIELDS },
  pagination = { limit: 100, offset: 0 },
}: GetConceptsParams): Promise<PConceptFull[]> => {
  // Convert new API to old API parameters
  const oldParams: Parameters<typeof getConceptsLegacy>[0] = {
    supabase,
    spaceId,
    nodeAuthor: author,
    conceptFields: fields.concepts,
    contentFields: fields.content,
    documentFields: fields.documents,
    relationFields: fields.relations,
    relationSubNodesFields: fields.relationNodes,
    limit: pagination.limit,
    offset: pagination.offset,
  };

  // Map scope to old parameters
  switch (scope.type) {
    case "all":
      oldParams.schemaLocalIds = [];
      oldParams.fetchNodes = null;
      break;
    case "nodes":
      oldParams.schemaLocalIds = scope.nodeTypes || [];
      oldParams.fetchNodes = true;
      break;
    case "relations":
      oldParams.schemaLocalIds = [];
      oldParams.fetchNodes = false;
      break;
    case "schemas":
      oldParams.schemaLocalIds = NODE_SCHEMAS;
      oldParams.fetchNodes = null;
      break;
    case "specific":
      oldParams.baseNodeLocalIds = scope.nodeIds || [];
      oldParams.schemaLocalIds = [];
      oldParams.fetchNodes = null;
      break;
  }

  // Map relation filters to old parameters
  if (relations) {
    if (relations.ofType) {
      oldParams.inRelsOfTypeLocal = relations.ofType;
    }
    if (relations.toNodeTypes) {
      oldParams.inRelsToNodesOfTypeLocal = relations.toNodeTypes;
    }
    if (relations.authoredBy) {
      oldParams.inRelsToNodesOfAuthor = relations.authoredBy;
    }
    if (relations.containingNode) {
      oldParams.inRelsToNodeLocalIds = [relations.containingNode];
    }
    if (relations.containingNodes) {
      oldParams.inRelsToNodeLocalIds = relations.containingNodes;
    }
  }

  return getConceptsLegacy(oldParams);
};

/**
 * Main function for querying concepts with the new grouped parameter API.
 * Provides better developer experience with logical parameter grouping and comprehensive IntelliSense.
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
 *   scope: { type: "nodes", nodeTypes: ["page", "note"] },
 *   relations: { ofType: ["cites", "references"] },
 *   author: "user123",
 *   pagination: { limit: 50, offset: 0 }
 * });
 *
 * // Query relations containing specific nodes
 * const relations = await getConcepts({
 *   supabase,
 *   spaceId: 123,
 *   scope: { type: "relations" },
 *   relations: { containingNodes: ["node-123", "node-456"] }
 * });
 * ```
 */
export const getConcepts = async (
  params: GetConceptsParams,
): Promise<PConceptFull[]> => {
  return getConceptsNew(params);
};

/**
 * Legacy getConcepts function with the original 17-parameter API.
 * Kept for backward compatibility. Consider using the new getConcepts() or primitive functions instead.
 *
 * @deprecated Use the new getConcepts() function with grouped parameters for better DX
 * @param params - Legacy parameters with individual fields
 * @returns Promise resolving to array of concept objects with full metadata
 *
 * @example
 * ```typescript
 * // Legacy usage (not recommended)
 * const results = await getConceptsLegacy({
 *   supabase,
 *   spaceId: 123,
 *   schemaLocalIds: ["page", "note"],
 *   fetchNodes: true,
 *   nodeAuthor: "user123",
 *   inRelsOfTypeLocal: ["cites"],
 *   conceptFields: ["id", "name", "created"],
 *   contentFields: ["source_local_id", "text"],
 *   limit: 100,
 *   offset: 0
 * });
 * ```
 */
export const getConceptsLegacy = async ({
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
