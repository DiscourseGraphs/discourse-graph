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
import {
  discoverSharedRelations,
  type DiscoverSharedRelationsResult,
  type TripleCandidate,
} from "./discoverSharedRelations";
import findDiscourseNode from "./findDiscourseNode";
import internalError from "./internalError";
import { getErrorMessage } from "./getErrorMessage";
import { DGSupabaseClient } from "@repo/database/lib/client";
import { deleteBlock } from "roamjs-components/writes";
import refreshConfigTree from "./refreshConfigTree";
import { getTemplateMarkdown } from "./resolveSharedNodeTypes";

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
        template: getTemplateMarkdown(schema.template),
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

const matchImportedRelationSchemas = async ({
  nodeSchemaRidToLocalId,
  relationTypeSchemas,
  relationTripleSchemas,
  relationSchemas,
}: {
  nodeSchemaRidToLocalId: Record<string, string>;
  relationTypeSchemas: CrossAppRelationTypeSchema[];
  relationTripleSchemas: CrossAppRelationTripleSchema[];
  relationSchemas: DiscourseRelation[];
}): Promise<Record<string, string>> => {
  const result: Record<string, string> = {};
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
      // Each query pattern can produce a match for the same local schema.
      const matchIds = [...new Set(match.map(({ id }) => id))];
      if (matchIds.length > 1) {
        throw new Error("multiple matches");
      }
      if (matchIds.length === 1) {
        blockUid = matchIds[0];
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

type RelationTripleContext = {
  relationSchemas: DiscourseRelation[];
  importedRids: Set<string>;
};

// A local triple fitting the pages' node types is correct by construction, so it wins;
// the source space's triple only supplies provenance for a new one.
const findOrImportRelationTriple = async ({
  relationType,
  sourceUid,
  destinationUid,
  candidates,
  matchedTripleRid,
  context,
}: {
  relationType: CrossAppRelationTypeSchema;
  sourceUid: string;
  destinationUid: string;
  candidates: TripleCandidate[];
  matchedTripleRid?: string;
  context: RelationTripleContext;
}): Promise<string> => {
  const sourceType = findDiscourseNode({ uid: sourceUid });
  if (!sourceType) throw new Error(`No node type for page: ${sourceUid}`);
  const destinationType = findDiscourseNode({ uid: destinationUid });
  if (!destinationType)
    throw new Error(`No node type for page: ${destinationUid}`);
  const fitsPages = (r: DiscourseRelation) =>
    r.source === sourceType.type && r.destination === destinationType.type;

  const label = relationType.label;
  // Each query pattern can produce a match for the same local schema.
  const matchIds = [
    ...new Set(
      context.relationSchemas
        .filter(
          (r) => fitsPages(r) && r.label.toLowerCase() === label.toLowerCase(),
        )
        .map(({ id }) => id),
    ),
  ];
  if (matchIds.length > 1) throw new Error("multiple matches");
  if (matchIds.length === 1) return matchIds[0];

  // Finds an imported triple even after a local rename.
  for (const candidate of candidates) {
    if (!context.importedRids.has(candidate.rid)) continue;
    const uid = await findImportedNodeUidBySourceRid(candidate.rid);
    const imported = context.relationSchemas.find((r) => r.id === uid);
    if (imported && fitsPages(imported)) return imported.id;
  }

  // Ends come from the pages: the source space's node types may be hidden.
  const matched = candidates.find(({ rid }) => rid === matchedTripleRid);
  const newRelation: Omit<DiscourseRelation, "id"> = {
    label: matched?.label ?? label,
    complement: matched?.complement ?? relationType.complement,
    source: sourceType.type,
    destination: destinationType.type,
    triples: [],
  };
  const id = await createRelationSchema(newRelation);
  // One source RID names one local triple: the lookup above returns a single block.
  if (matched && !context.importedRids.has(matched.rid)) {
    await writeImportedSourceIdentity({
      pageUid: id,
      sourceNodeRid: matched.rid,
      sourceModifiedAt: (matched.modifiedAt ?? new Date()).toISOString(),
    });
    context.importedRids.add(matched.rid);
  }
  context.relationSchemas.push({ ...newRelation, id });
  return id;
};

const importRelation = async ({
  relation,
  schemaRidToLocalId,
  discovered,
  existing,
  allRelations,
  context,
}: {
  relation: CrossAppRelation;
  schemaRidToLocalId: Record<string, string>;
  discovered: DiscoverSharedRelationsResult;
  existing: Set<string>;
  allRelations: Awaited<ReturnType<typeof getReifiedRelations>>;
  context: RelationTripleContext;
}): Promise<void> => {
  const { rid: sourceNodeRid, source, destination, relationType } = relation;
  if (sourceNodeRid === undefined) return;
  const { spaceUri } = ridToSpaceUriAndLocalId(sourceNodeRid);
  const schemaRid = spaceUriAndLocalIdToRid(spaceUri, relationType, "schema");
  const sourceUid = await findTargetUid(source, spaceUri);
  if (sourceUid === null) throw new Error(`Missing relation source: ${source}`);
  const destinationUid = await findTargetUid(destination, spaceUri);
  if (destinationUid === null)
    throw new Error(`Missing relation destination: ${destination}`);
  let relationBlockUid = schemaRidToLocalId[schemaRid];
  if (relationBlockUid === undefined) {
    const relationTypeSchema = discovered.relTypeSchemas.find(
      ({ rid }) => rid === schemaRid,
    );
    if (relationTypeSchema === undefined)
      throw new Error(`Missing relation type: ${relationType}`);
    relationBlockUid = await findOrImportRelationTriple({
      relationType: relationTypeSchema,
      sourceUid,
      destinationUid,
      candidates: discovered.tripleCandidatesByRelationType[schemaRid] ?? [],
      matchedTripleRid: discovered.matchedTripleByRelation[sourceNodeRid],
      context,
    });
  }
  if (existing.has(sourceNodeRid)) {
    // Update existing
    const existingRelUid = await findImportedNodeUidBySourceRid(sourceNodeRid);
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
      return;
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
};

const importRelations = async (
  schemaRidToLocalId: Record<string, string>,
  discovered: DiscoverSharedRelationsResult,
  relationSchemas: DiscourseRelation[],
): Promise<string[]> => {
  const existing = await getImportedSourceRids();
  const allRelations = await getReifiedRelations();
  const context: RelationTripleContext = {
    relationSchemas,
    importedRids: existing,
  };
  const failures: string[] = [];
  for (const relation of discovered.relations) {
    try {
      await importRelation({
        relation,
        schemaRidToLocalId,
        discovered,
        existing,
        allRelations,
        context,
      });
    } catch (error) {
      failures.push(
        `${relation.rid ?? relation.localId}: ${getErrorMessage(error)}`,
      );
    }
  }
  if (failures.length > 0)
    internalError({
      error: new Error(
        `${failures.length} of ${discovered.relations.length} shared relation imports failed`,
      ),
      type: "Shared relation import failed",
      context: {
        operation: "import-shared-relations",
        failureMessages: failures,
      },
      sendEmail: false,
    });
  return failures;
};

// One message per relation: `failures` failed to import, `skipped` have a schema the
// reader cannot see.
export type SharedRelationImportResult = {
  failures: string[];
  skipped: string[];
};

export const importSharedRelations = async (
  client: DGSupabaseClient,
  spaceId: number,
): Promise<SharedRelationImportResult> => {
  const discovered = await discoverSharedRelations(client, spaceId);
  const { relTripleSchemas, relTypeSchemas, nodeSchemas } = discovered;
  // Shared by both passes, so a triple the first creates is matched by the second.
  const relationSchemas = getDiscourseRelations();
  let ridToLocalId = await matchImportedNodeSchemas(nodeSchemas);
  const relationSchemaMap = await matchImportedRelationSchemas({
    nodeSchemaRidToLocalId: ridToLocalId,
    relationTypeSchemas: relTypeSchemas,
    relationTripleSchemas: relTripleSchemas,
    relationSchemas,
  });
  ridToLocalId = { ...ridToLocalId, ...relationSchemaMap };
  const failures = await importRelations(
    ridToLocalId,
    discovered,
    relationSchemas,
  );
  // Legacy settings read the cached grammar, including newly imported schemas.
  refreshConfigTree();
  return { failures, skipped: discovered.skippedRelations };
};
