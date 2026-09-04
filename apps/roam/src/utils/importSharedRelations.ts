import type {
  CrossAppRelation,
  CrossAppRelationTypeSchema,
  CrossAppRelationTripleSchema,
  CrossAppNodeSchema,
} from "@repo/database/crossAppContracts";
import {
  spaceUriAndLocalIdToRid,
  ridToSpaceUriAndLocalId,
} from "@repo/database/lib/rid";
import { findTargetUid } from "./findTargetUid";
import {
  findImportedNodeUidBySourceRid,
  getImportedSourceRids,
  writeImportedSourceIdentity,
} from "./importedSourceIdentity";
import getDiscourseRelations, {
  type DiscourseRelation,
} from "./getDiscourseRelations";
import getDiscourseNodes from "./getDiscourseNodes";
import { createDiscourseNodeType } from "~/components/settings/utils/accessors";
import { createRelationSchema } from "./createRelationSchema";
import {
  createReifiedRelation,
  getReifiedRelations,
} from "./createReifiedBlock";
import { discoverSharedRelations } from "./discoverSharedRelations";
import { DGSupabaseClient } from "@repo/database/lib/client";
import { deleteBlock } from "roamjs-components/writes";

const matchImportedNodeSchemas = async (
  nodeSchemas: CrossAppNodeSchema[],
): Promise<Record<string, string>> => {
  const result: Record<string, string> = {};
  const nodeSchemasByRid = Object.fromEntries(
    nodeSchemas.map((s) => [s.rid!, s]),
  );
  const existing = await getImportedSourceRids();
  const localNodeSchemas = getDiscourseNodes();
  const localNodeSchemasByLabel = Object.fromEntries(
    localNodeSchemas.map((s) => [s.text.toLowerCase(), s]),
  );
  const localNodeSchemasByLocalId = Object.fromEntries(
    localNodeSchemas.map((s) => [s.type, s]),
  );

  for (const [rid, schema] of Object.entries(nodeSchemasByRid)) {
    let blockUid: string | undefined | null;
    if (existing.has(rid)) {
      blockUid = await findImportedNodeUidBySourceRid(rid);
    }
    if (blockUid) {
      result[rid] = blockUid;
      continue;
    } else if (schema.localId in localNodeSchemasByLocalId) {
      blockUid = localNodeSchemasByLocalId[schema.localId].type;
    } else if (schema.label.toLowerCase() in localNodeSchemasByLabel) {
      blockUid = localNodeSchemasByLabel[schema.label.toLowerCase()].type;
    } else {
      // create a new node schema
      const node = await createDiscourseNodeType({
        label: schema.label,
        template: schema.template,
        // TODO: colour, other metadata?
      });
      blockUid = node.type;
      await writeImportedSourceIdentity({
        pageUid: blockUid,
        sourceNodeRid: rid,
        sourceModifiedAt: (schema.modifiedAt ?? new Date()).toISOString(),
      });
      localNodeSchemasByLabel[node.text.toLowerCase()] = node;
      localNodeSchemasByLocalId[blockUid] = node;
    }
    result[rid] = blockUid;
  }
  return result;
};

const matchImportedRelationSchemas = async (
  nodeSchemaRidToLocalId: Record<string, string>,
  relationTypeSchemas: CrossAppRelationTypeSchema[],
  relationTripleSchemas: CrossAppRelationTripleSchema[],
): Promise<Record<string, string>> => {
  const result: Record<string, string> = {};
  const relationSchemas = getDiscourseRelations();
  const existing = await getImportedSourceRids();
  const relationTypeSchemasByRid = Object.fromEntries(
    relationTypeSchemas.map((s) => [s.rid!, s]),
  );
  const localRelationTripleSchemasByLocalId = Object.fromEntries(
    relationSchemas.map((s) => [s.id, s]),
  );

  for (const tripleSchema of relationTripleSchemas) {
    const rid = tripleSchema.rid!;
    const { spaceUri } = ridToSpaceUriAndLocalId(rid);
    let blockUid: string | undefined | null;
    if (existing.has(rid)) {
      blockUid = await findImportedNodeUidBySourceRid(rid);
    }
    if (blockUid) {
      result[rid] = blockUid;
      continue;
    }
    if (tripleSchema.localId in localRelationTripleSchemasByLocalId) {
      blockUid = localRelationTripleSchemasByLocalId[tripleSchema.localId].id;
    } else {
      const { sourceType, destinationType, relation } = tripleSchema;
      const sourceTypeRid = spaceUriAndLocalIdToRid(
        spaceUri,
        sourceType,
        "schema",
      );
      const destinationTypeRid = spaceUriAndLocalIdToRid(
        spaceUri,
        destinationType,
        "schema",
      );
      const source = nodeSchemaRidToLocalId[sourceTypeRid] ?? "missing";
      const destination =
        nodeSchemaRidToLocalId[destinationTypeRid] ?? "missing";
      if (source === "missing" || destination === "missing")
        throw new Error("Missing source or destination");
      const relationType = relation
        ? relationTypeSchemasByRid[
            spaceUriAndLocalIdToRid(spaceUri, relation, "schema")
          ]
        : undefined;

      const label = tripleSchema.label ?? relationType?.label;
      if (label === undefined) throw new Error("Could not get label");
      const complement = tripleSchema.complement ?? relationType?.complement;
      if (complement === undefined) throw new Error("Could not get complement");
      const match = relationSchemas.filter(
        (r) =>
          r.label.toLowerCase() === label.toLowerCase() &&
          r.source === source &&
          r.destination === destination,
      );
      if (match.length > 1) {
        throw new Error("multiple matches");
      }
      if (match.length === 1) {
        blockUid = match[0].id;
      } else {
        blockUid = await createRelationSchema({
          label,
          complement,
          source,
          destination,
        });
        await writeImportedSourceIdentity({
          pageUid: blockUid,
          sourceNodeRid: rid,
          sourceModifiedAt: (
            tripleSchema.modifiedAt ?? new Date()
          ).toISOString(),
        });
        const newRelation: DiscourseRelation = {
          id: blockUid,
          label,
          complement,
          source,
          destination,
          triples: [],
        };
        relationSchemas.push(newRelation);
        localRelationTripleSchemasByLocalId[blockUid] = newRelation;
      }
      result[rid] = blockUid;
    }
  }
  return result;
};

const importRelations = async (
  schemaRidToLocalId: Record<string, string>,
  relations: CrossAppRelation[],
): Promise<void> => {
  const existing = await getImportedSourceRids();
  const allRelations = await getReifiedRelations();
  for (const relation of relations) {
    const { rid: sourceNodeRid, source, destination, relationType } = relation;
    if (sourceNodeRid === undefined) continue;
    const { spaceUri } = ridToSpaceUriAndLocalId(sourceNodeRid);
    const schemaRid = spaceUriAndLocalIdToRid(spaceUri, relationType, "schema");
    const relationBlockUid = schemaRidToLocalId[schemaRid];
    if (relationBlockUid === undefined)
      throw new Error(`Missing relation type: ${relationType}`);
    const sourceUid = await findTargetUid(source, spaceUri);
    if (sourceUid === null)
      throw new Error(`Missing relation source: ${source}`);
    const destinationUid = await findTargetUid(destination, spaceUri);
    if (destinationUid === null)
      throw new Error(`Missing relation destination: ${destination}`);
    if (existing.has(sourceNodeRid)) {
      // Update existing
      const existingRelUid =
        await findImportedNodeUidBySourceRid(sourceNodeRid);
      if (existingRelUid === null)
        throw new Error("Could not get imported block");
      const existingRel = allRelations.find(
        (r) => r.relationId === existingRelUid,
      );
      if (existingRel === undefined) throw new Error("Could not find relation");
      if (
        existingRel.hasSchema === relationBlockUid &&
        existingRel.sourceUid === sourceUid &&
        existingRel.destinationUid === destinationUid
      )
        continue;
      // It was imported and modified. We could update, but easier to delete and recreate.
      await deleteBlock(existingRelUid);
    }

    const existingRel = allRelations.filter(
      (r) =>
        r.hasSchema === relationBlockUid &&
        r.sourceUid === sourceUid &&
        r.destinationUid === destinationUid,
    );
    if (existingRel.length > 1) throw new Error("Multiple matching relations");
    if (existingRel.length === 0) {
      const uid = await createReifiedRelation({
        sourceUid,
        destinationUid,
        relationBlockUid,
        tentative: true,
      });
      await writeImportedSourceIdentity({
        pageUid: uid,
        sourceNodeRid,
        sourceModifiedAt: (relation.modifiedAt ?? new Date()).toISOString(),
      });
    }
  }
};

export const importSharedRelations = async (
  client: DGSupabaseClient,
  spaceId: number,
  futureImportRids?: string[],
) => {
  const { relations, relTripleSchemas, relTypeSchemas, nodeSchemas } =
    await discoverSharedRelations(client, spaceId, futureImportRids);
  let ridToLocalId = await matchImportedNodeSchemas(nodeSchemas);
  const relationSchemaMap = await matchImportedRelationSchemas(
    ridToLocalId,
    relTypeSchemas,
    relTripleSchemas,
  );
  ridToLocalId = { ...ridToLocalId, ...relationSchemaMap };
  await importRelations(ridToLocalId, relations);
};
