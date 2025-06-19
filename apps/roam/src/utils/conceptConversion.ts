import { DiscourseNode } from "./getDiscourseNodes";
import getDiscourseRelations from "./getDiscourseRelations";
import type { DiscourseRelation } from "./getDiscourseRelations";
import { Database } from "@repo/database/types.gen";
import type { SupabaseContext } from "~/utils/supabaseContext";

// When it's merged: import type { LocalConceptDataInput } from '@repo/database/input_types';
type LocalConceptDataInput = Partial<Database["public"]["CompositeTypes"]["concept_local_input"]>;

// Get data from roam about the node
const getNodeExtraData = (node_uid: string): { author_uid: string, created: string, last_modified: string, page_uid: string } => {
  const result = window.roamAlphaAPI.q(`[
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
  ]`, node_uid);
  if (result.length != 1 || result[0].length != 4)
    throw new Error("Invalid result from Roam query");

  const [author_uid, page_uid, created_t, last_modified_t] = result[0] as [string, string, number, number];
  const created = new Date(created_t).toISOString();
  const last_modified = new Date(last_modified_t).toISOString();
  return {
    author_uid,
    created,
    last_modified,
    page_uid
  }
}


export function discourseNodeSchemaToLocalConcept(
  context: SupabaseContext,
  node: DiscourseNode, // contains type, uid, text
): LocalConceptDataInput {
  const extra_data = getNodeExtraData(node.type);
  const title_parts = node.text.split('/');
  return {
    space_id: context.spaceId,
    author_local_id: extra_data.author_uid,
    created: extra_data.created,
    last_modified: extra_data.last_modified,
    name: title_parts[title_parts.length - 1],
    represented_by_local_id: node.type,
    is_schema: true,
  };
}


export function discourseNodeBlockToLocalConcept(
  context: SupabaseContext,
  {
    node_uid,
    schema_uid,
    text
  }: {
    node_uid: string,
    schema_uid: string,
    text: string
  }
): LocalConceptDataInput {
  const extra_data = getNodeExtraData(node_uid);
  return {
    space_id: context.spaceId,
    author_local_id: extra_data.author_uid,
    created: extra_data.created,
    last_modified: extra_data.last_modified,
    name: text,
    represented_by_local_id: node_uid,
    schema_represented_by_local_id: schema_uid,
    is_schema: false,
  };

}

const STANDARD_ROLES = ["source", "target"];

export function discourseRelationSchemaToLocalConcept(
  context: SupabaseContext,
  relation: DiscourseRelation, // contains type, uid, text
): LocalConceptDataInput {
  const extra_data = getNodeExtraData(relation.id);
  return {
    space_id: context.spaceId,
    represented_by_local_id: relation.id,
    author_local_id: extra_data.author_uid,
    created: extra_data.created,
    last_modified: extra_data.last_modified,
    name: `${relation.id}-${relation.label}`,  // the label is not unique
    is_schema: true,
    local_reference_content: Object.fromEntries(
      Object.entries(relation)
        .filter(([key, v]) => STANDARD_ROLES.includes(key))
      ) as { [key: string]: string },
    literal_content: {
      roles: STANDARD_ROLES,
      label: relation.label,
      complement: relation.complement,
      representation: relation.triples.map(t=>t[0]),
    },
  };
}

export function discourseRelationDataToLocalConcept(
  context: SupabaseContext,
  relationSchemaUid: string,
  relationNodes: { [role: string]: string },
): LocalConceptDataInput {
  const roamRelation = getDiscourseRelations().find(r => r.id === relationSchemaUid);
  if (roamRelation === undefined) {
    throw new Error(`Invalid roam relation id ${relationSchemaUid}`)
  }
  const relation = discourseRelationSchemaToLocalConcept(context, roamRelation);
  const lit_content = ((relation.literal_content)? relation.literal_content: {}) as unknown as {[key: string]: any};
  const roles = (lit_content['roles'] as string[] | undefined)  || STANDARD_ROLES;
  const casting = Object.fromEntries(
    roles
      .map((role) => [role, relationNodes[role]])
      .filter(([, uid]) => uid !== undefined)
  );
  if (Object.keys(casting).length === 0) {
    throw new Error(`No valid node UIDs supplied for roles ${roles.join(", ")}`);
  }
  // TODO: Also get the nodes from the representation, using QueryBuilder. That will likely give me the relation object
  const nodeData = Object.values(casting).map((v) => getNodeExtraData(v));
  // roundabout way to do a max from stringified dates
  const last_modified = new Date(Math.max(...nodeData.map((nd) => new Date(nd.last_modified).getTime()))).toISOString();
  // creation is actually creation of the relation node, not the rest of the cast, but this will do as a first approximation.
  // Still using max, since the relation cannot be created before its cast
  const created = new Date(Math.max(...nodeData.map((nd) => new Date(nd.created).getTime()))).toISOString();
  const author_local_id: string = nodeData[0].author_uid;  // take any one; again until I get the relation object
  const represented_by_local_id = (casting["target"] || Object.values(casting)[0]); // This one is tricky. Prefer the target for now.
  return {
    space_id: context.spaceId,
    represented_by_local_id,
    author_local_id,
    created,
    last_modified,
    name: `${relationSchemaUid}-${Object.values(casting).join('-')}`,
    is_schema: false,
    schema_represented_by_local_id: relationSchemaUid,
    local_reference_content: casting,
  };
}

const relatedConcepts = (concept: LocalConceptDataInput): string[] => {
  const relations = Object.values(concept.local_reference_content || {}).flat();
  if (concept.schema_represented_by_local_id) {
    relations.push(concept.schema_represented_by_local_id)
  }
  // remove duplicates
  return [...new Set(relations)];
}

const contentRelatedToConcept = (concept: LocalConceptDataInput): string[] => {
  const relations = relatedConcepts(concept);
  if (concept.represented_by_local_id && !relations.includes(concept.represented_by_local_id)) {
    relations.push(concept.represented_by_local_id)
  }
  return relations;
}

// From those two, a function could in theory ensure that a concept's dependent concepts are already in the database.
// It is probably going to be best done in bulk.

// the input to the upsert method would look like this:

// const idata: LocalConceptDataInput[] = [
//   { "name": "Claim", "author_local_id": "sR22zZ470dNPkIf9PpjQXXdTBjG2", "represented_by_local_id": "a_roam_uid", "created": "2000/01/01", "last_modified": "2001/01/02", "is_schema": true },
//   { "name": "A Claim", "author_local_id": "sR22zZ470dNPkIf9PpjQXXdTBjG2", "represented_by_local_id": "a_roam_uid2", "created": "2000/01/03", "last_modified": "2001/01/04", "is_schema": false, "schema_represented_by_local_id": "a_roam_uid" },
//   { "name": "test2", "author_local_id": "sR22zZ470dNPkIf9PpjQXXdTBjG2", "created": "2000/01/04", "last_modified": "2001/01/05", "is_schema": false, "literal_content": { "source": "a_roam_uid", "target": ["a_roam_uid", "a_roam_uid2"] }, "local_reference_content": { "source": "a_roam_uid", "target": ["a_roam_uid", "a_roam_uid2"] } }]

// const { data, error } = await supabase_client.rpc("upsert_concepts", { v_space_id: 12, data: idata });
