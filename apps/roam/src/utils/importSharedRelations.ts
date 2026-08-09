import type {
  CrossAppRelation,
  CrossAppRelationTypeSchema,
  CrossAppRelationTripleSchema,
  CrossAppNodeSchema,
} from "@repo/database/crossAppContracts";
import {
  spaceUriAndLocalIdToRid,
  isRid,
  ridToSpaceUriAndLocalId,
} from "@repo/database/lib/rid";
import {
  findImportedNodeUidBySourceRid,
  getImportedSourceRids,
  writeImportedSourceIdentity,
} from "./importedSourceIdentity";
import getDiscourseRelations from "./getDiscourseRelations";
import getDiscourseNodes from "./getDiscourseNodes";
import { createDiscourseNodeSchema } from "./createDiscourseNodeSchema";
import { createRelationSchema } from "./createRelationSchema";
import {
  createReifiedRelation,
  getReifiedRelations,
} from "./createReifiedBlock";
import { discoverSharedRelations } from "./discoverSharedRelations";
import { DGSupabaseClient } from "@repo/database/lib/client";

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
      blockUid = await createDiscourseNodeSchema(schema.label, {
        template: schema.template,
        // TODO: colour, other metadata?
      });
    }
    result[rid] = blockUid;
    await writeImportedSourceIdentity({
      pageUid: blockUid,
      sourceNodeRid: rid,
      sourceModifiedAt: (schema.modifiedAt ?? new Date()).toISOString(),
    });
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
      const sourceTypeRid = tripleSchema.rid!;
      const destinationTypeRid = tripleSchema.rid!;
      const source = nodeSchemaRidToLocalId[sourceTypeRid] ?? "missing";
      const destination =
        nodeSchemaRidToLocalId[destinationTypeRid] ?? "missing";
      if (source === "missing" || destination === "missing")
        throw new Error("Missing source or destination");
      const relationType =
        relationTypeSchemasByRid[tripleSchema.relation ?? ""];

      const label = tripleSchema.label ?? relationType?.label;
      const complement = tripleSchema.complement ?? relationType?.complement;
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
      }
    }
    result[rid] = blockUid;
    await writeImportedSourceIdentity({
      pageUid: blockUid,
      sourceNodeRid: rid,
      sourceModifiedAt: (tripleSchema.modifiedAt ?? new Date()).toISOString(),
    });
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
    const sourceNodeRid = relation.rid;
    if (sourceNodeRid === undefined) continue;
    const { spaceUri } = ridToSpaceUriAndLocalId(sourceNodeRid);
    if (existing.has(sourceNodeRid)) continue;
    const relationBlockUid = schemaRidToLocalId[sourceNodeRid];
    if (relationBlockUid === undefined)
      throw new Error(`Missing relation type: ${relation.relationType}`);
    const relSource = isRid(relation.source)
      ? relation.source
      : spaceUriAndLocalIdToRid(spaceUri, relation.source, "note");
    const relDestination = isRid(relation.destination)
      ? relation.destination
      : spaceUriAndLocalIdToRid(spaceUri, relation.destination, "note");
    const sourceUid = schemaRidToLocalId[relSource];
    if (sourceUid === undefined)
      throw new Error(`Missing relation source: ${relation.source}`);
    const destinationUid = schemaRidToLocalId[relDestination];
    if (destinationUid === undefined)
      throw new Error(`Missing relation destination: ${relation.destination}`);
    const existingRel = allRelations.filter(
      (r) =>
        r.hasSchema == relationBlockUid &&
        r.sourceUid == sourceUid &&
        r.destinationUid == r.destinationUid,
    );
    if (existingRel.length > 1) throw new Error("Multiple matching relations");
    const uid =
      existingRel.length === 1
        ? existingRel[0].relationId
        : await createReifiedRelation({
            sourceUid,
            destinationUid,
            relationBlockUid,
          });
    await writeImportedSourceIdentity({
      pageUid: uid,
      sourceNodeRid,
      sourceModifiedAt: (relation.modifiedAt ?? new Date()).toISOString(),
    });
  }
};

export const importSharedRelations = async (
  client: DGSupabaseClient,
  spaceId: number,
) => {
  const { relations, relTripleSchemas, relTypeSchemas, nodeSchemas, idToRid } =
    await discoverSharedRelations(client, spaceId);
  let ridToId = Object.fromEntries(
    Object.entries(idToRid).map(([id, rid]) => [rid, id]),
  );
  const nodeSchemasMap = await matchImportedNodeSchemas(nodeSchemas);
  ridToId = { ...ridToId, ...nodeSchemasMap };
  const relationSchemaMap = await matchImportedRelationSchemas(
    ridToId,
    relTypeSchemas,
    relTripleSchemas,
  );
  ridToId = { ...ridToId, ...relationSchemaMap };
  await importRelations(ridToId, relations);
};
