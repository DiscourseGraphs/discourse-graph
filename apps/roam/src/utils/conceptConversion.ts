import { DiscourseNode } from "./getDiscourseNodes";
import getDiscourseRelations from "./getDiscourseRelations";
import type { DiscourseRelation } from "./getDiscourseRelations";
import { Database } from "@repo/database/types.gen";
import type { SupabaseContext } from "~/utils/supabaseContext";

import type { LocalConceptDataInput } from "@repo/database/input_types";

const getNodeExtraData = (
  node_uid: string,
): {
  author_uid: string;
  created: string;
  last_modified: string;
  page_uid: string;
} => {
  const result = window.roamAlphaAPI.q(
    `[
    :find
      ?author_uid
      ?page_uid
      ?created
      ?last_modified
      :in $ ?block_uid
      :where
      [?block :block/uid ?block_uid]
      [?block :create/user ?author_id]
      [?author_id :user/uid ?author_uid]
      [?block :create/time ?created]
      [?block :edit/time ?last_modified]
      [(get-else $ ?block :block/page ?block) ?page_id]
      [?page_id :block/uid ?page_uid]
  ]`,
    node_uid,
  );
  if (result.length !== 1 || result[0].length !== 4)
    throw new Error("Invalid result from Roam query");

  const [author_uid, page_uid, created_t, last_modified_t] = result[0] as [
    string,
    string,
    number,
    number,
  ];
  const created = new Date(created_t).toISOString();
  const last_modified = new Date(last_modified_t).toISOString();
  return {
    author_uid,
    created,
    last_modified,
    page_uid,
  };
};

export const discourseNodeSchemaToLocalConcept = (
  context: SupabaseContext,
  node: DiscourseNode,
): LocalConceptDataInput => {
  const titleParts = node.text.split("/");
  return {
    space_id: context.spaceId,
    name: titleParts[titleParts.length - 1],
    represented_by_local_id: node.type,
    is_schema: true,
    ...getNodeExtraData(node.type),
  };
};

export const discourseNodeBlockToLocalConcept = (
  context: SupabaseContext,
  {
    node_uid,
    schema_uid,
    text,
  }: {
    node_uid: string;
    schema_uid: string;
    text: string;
  },
): LocalConceptDataInput => {
  return {
    space_id: context.spaceId,
    name: text,
    represented_by_local_id: node_uid,
    schema_represented_by_local_id: schema_uid,
    is_schema: false,
    ...getNodeExtraData(node_uid),
  };
};

const STANDARD_ROLES = ["source", "target"];

export const discourseRelationSchemaToLocalConcept = (
  context: SupabaseContext,
  relation: DiscourseRelation,
): LocalConceptDataInput => {
  return {
    space_id: context.spaceId,
    represented_by_local_id: relation.id,
    // Not using the label directly, because it is not unique and name should be unique
    name: `${relation.id}-${relation.label}`,
    is_schema: true,
    local_reference_content: Object.fromEntries(
      Object.entries(relation).filter(([key, v]) =>
        STANDARD_ROLES.includes(key),
      ),
    ) as { [key: string]: string },
    literal_content: {
      roles: STANDARD_ROLES,
      label: relation.label,
      complement: relation.complement,
      representation: relation.triples.map((t) => t[0]),
    },
    ...getNodeExtraData(relation.id),
  };
};

export const discourseRelationDataToLocalConcept = (
  context: SupabaseContext,
  relationSchemaUid: string,
  relationNodes: { [role: string]: string },
): LocalConceptDataInput => {
  const roamRelation = getDiscourseRelations().find(
    (r) => r.id === relationSchemaUid,
  );
  if (roamRelation === undefined) {
    throw new Error(`Invalid roam relation id ${relationSchemaUid}`);
  }
  const relation = discourseRelationSchemaToLocalConcept(context, roamRelation);
  const litContent = (relation.literal_content
    ? relation.literal_content
    : {}) as unknown as { [key: string]: any };
  const roles = (litContent["roles"] as string[] | undefined) || STANDARD_ROLES;
  const casting: { [role: string]: string } = Object.fromEntries(
    roles
      .map((role) => [role, relationNodes[role]])
      .filter(([, uid]) => uid !== undefined),
  );
  if (Object.keys(casting).length === 0) {
    throw new Error(
      `No valid node UIDs supplied for roles ${roles.join(", ")}`,
    );
  }
  // TODO: Also get the nodes from the representation, using QueryBuilder. That will likely give me the relation object
  const nodeData = Object.values(casting).map((v) => getNodeExtraData(v));
  // roundabout way to do a max from stringified dates
  const last_modified = new Date(
    Math.max(...nodeData.map((nd) => new Date(nd.last_modified).getTime())),
  ).toISOString();
  // creation is actually creation of the relation node, not the rest of the cast, but this will do as a first approximation.
  // Still using max, since the relation cannot be created before its cast
  const created = new Date(
    Math.max(...nodeData.map((nd) => new Date(nd.created).getTime())),
  ).toISOString();
  const author_local_id: string = nodeData[0].author_uid; // take any one; again until I get the relation object
  const represented_by_local_id =
    casting["target"] || Object.values(casting)[0]; // This one is tricky. Prefer the target for now.
  return {
    space_id: context.spaceId,
    represented_by_local_id,
    author_local_id,
    created,
    last_modified,
    name: `${relationSchemaUid}-${Object.values(casting).join("-")}`,
    is_schema: false,
    schema_represented_by_local_id: relationSchemaUid,
    local_reference_content: casting,
  };
};

export const relatedConcepts = (concept: LocalConceptDataInput): string[] => {
  const relations = Object.values(
    concept.local_reference_content || {},
  ).flat() as string[];
  if (concept.schema_represented_by_local_id) {
    relations.push(concept.schema_represented_by_local_id);
  }
  // remove duplicates
  return [...new Set(relations)];
};

const orderConceptsRec = (
  ordered: LocalConceptDataInput[],
  concept: LocalConceptDataInput,
  remainder: { [key: string]: LocalConceptDataInput },
): Set<string> => {
  const relatedConceptIds = relatedConcepts(concept);
  let missing: Set<string> = new Set();
  while (relatedConceptIds.length > 0) {
    const relatedConceptId = relatedConceptIds.shift()!;
    const relatedConcept = remainder[relatedConceptId];
    if (relatedConcept === undefined) {
      missing.add(relatedConceptId);
    } else {
      missing = missing.union(
        orderConceptsRec(ordered, relatedConcept, remainder),
      );
      delete remainder[relatedConceptId];
    }
  }
  ordered.push(concept);
  delete remainder[concept.represented_by_local_id!];
  return missing;
};

/*
If writing a concept upsert method, you want to insure that
a node's dependencies are defined before the node itself is upserted.
The dependencies are as defined in relatedConcepts.
If you upsert in the following order: [node schemas, relation schemas, nodes, relations]
then the depencies will be implicitly respected.
(It will be tricker when we have recursive relations.)
If you are starting from a random stream of nodes, you would want to order them with this function.
It assumes all input has defined represented_by_local_id,
and that nodes that are not in the upsert set are already in the database.
the Id of those nodes is returned and can be used to check that assumption.
We also assume that there are no dependency cycles.
 */
export const orderConceptsByDependency = (
  concepts: LocalConceptDataInput[],
): { ordered: LocalConceptDataInput[]; missing: string[] } => {
  if (concepts.length === 0) return { ordered: concepts, missing: [] };
  const conceptById: { [key: string]: LocalConceptDataInput } =
    Object.fromEntries(concepts.map((c) => [c.represented_by_local_id, c]));
  const ordered: LocalConceptDataInput[] = [];
  let missing: Set<string> = new Set();
  while (Object.keys(conceptById).length > 0) {
    const first = conceptById[concepts[0].represented_by_local_id!];
    missing = missing.union(orderConceptsRec(ordered, first, conceptById));
  }
  return { ordered, missing: [...missing] };
};

// the input to the upsert method would look like this:

// const idata: LocalConceptDataInput[] = [
//   { "name": "Claim", "author_local_id": "sR22zZ470dNPkIf9PpjQXXdTBjG2", "represented_by_local_id": "a_roam_uid", "created": "2000/01/01", "last_modified": "2001/01/02", "is_schema": true },
//   { "name": "A Claim", "author_local_id": "sR22zZ470dNPkIf9PpjQXXdTBjG2", "represented_by_local_id": "a_roam_uid2", "created": "2000/01/03", "last_modified": "2001/01/04", "is_schema": false, "schema_represented_by_local_id": "a_roam_uid" },
//   { "name": "test2", "author_local_id": "sR22zZ470dNPkIf9PpjQXXdTBjG2", "created": "2000/01/04", "last_modified": "2001/01/05", "is_schema": false, "literal_content": { "source": "a_roam_uid", "target": ["a_roam_uid", "a_roam_uid2"] }, "local_reference_content": { "source": "a_roam_uid", "target": ["a_roam_uid", "a_roam_uid2"] } }]

// const { data, error } = await supabase_client.rpc("upsert_concepts", { v_space_id: 12, data: idata });
