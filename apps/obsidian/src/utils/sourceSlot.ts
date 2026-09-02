import {
  isRid,
  ridToSpaceUriAndLocalId,
  spaceUriAndLocalIdToRid,
} from "@repo/database/lib/rid";
import type { Json } from "@repo/database/dbTypes";
import type { DiscourseNode, RelationInstance } from "~/types";
import type { DiscourseNodeInVault } from "./getDiscourseNodes";

// Temporary hack, the Obsidian twin of apps/roam/src/utils/sourceSlot.ts: until slots
// are a first-class node type setting, the Source type is the node type named "Source",
// and a node's sourceDocument is the destination of its earliest relation to a node of
// that type. Relation endpoints are stored as a nodeInstanceId, as this vault's RID for
// it, or as an imported node's origin RID, so lookups go through an index of all three.

export const SOURCE_SLOT = "sourceDocument";

type NodesByEndpoint = Record<string, DiscourseNodeInVault>;

const indexNodesByEndpoint = ({
  nodes,
  localSpaceUri,
}: {
  nodes: DiscourseNodeInVault[];
  localSpaceUri: string;
}): NodesByEndpoint => {
  const index: NodesByEndpoint = {};
  for (const node of nodes) {
    index[node.nodeInstanceId] = node;
    index[spaceUriAndLocalIdToRid(localSpaceUri, node.nodeInstanceId, "note")] =
      node;
    const importedFromRid = node.frontmatter.importedFromRid;
    if (typeof importedFromRid === "string") index[importedFromRid] = node;
  }
  return index;
};

const isSourceNodeType = (nodeType: DiscourseNode | undefined): boolean =>
  nodeType?.name.toLowerCase() === "source";

const byCreatedThenId = (a: RelationInstance, b: RelationInstance): number =>
  a.created - b.created || a.id.localeCompare(b.id);

const sourceDocumentIdOf = (node: DiscourseNodeInVault): string => {
  const importedFromRid = node.frontmatter.importedFromRid;
  return typeof importedFromRid === "string"
    ? importedFromRid
    : node.nodeInstanceId;
};

type SourceCandidate = {
  relation: RelationInstance;
  sourceDocumentNode: DiscourseNodeInVault;
};

export const indexSourceSlotValues = ({
  relations,
  nodes,
  localSpaceUri,
  nodeTypesById,
}: {
  relations: RelationInstance[];
  nodes: DiscourseNodeInVault[];
  localSpaceUri: string;
  nodeTypesById: Record<string, DiscourseNode>;
}): Record<string, string> => {
  const nodesByEndpoint = indexNodesByEndpoint({ nodes, localSpaceUri });
  const earliestByNodeId: Record<string, SourceCandidate> = {};
  for (const relation of relations) {
    if (relation.tentative === false) continue;
    const node = nodesByEndpoint[relation.source];
    const sourceDocumentNode = nodesByEndpoint[relation.destination];
    if (!node || !sourceDocumentNode) continue;
    if (!isSourceNodeType(nodeTypesById[sourceDocumentNode.nodeTypeId]))
      continue;
    const current = earliestByNodeId[node.nodeInstanceId];
    if (!current || byCreatedThenId(relation, current.relation) < 0)
      earliestByNodeId[node.nodeInstanceId] = { relation, sourceDocumentNode };
  }
  return Object.fromEntries(
    Object.entries(earliestByNodeId).map(([nodeInstanceId, candidate]) => [
      nodeInstanceId,
      sourceDocumentIdOf(candidate.sourceDocumentNode),
    ]),
  );
};

export const SOURCE_SLOT_PROBE_SELECT =
  "reference_content, concepts_of_relation(id, source_local_id)";

export type SourceSlotProbeRow = {
  source_local_id: string | null;
  reference_content: Json | null;
  concepts_of_relation: {
    id: number | null;
    source_local_id: string | null;
  }[];
};

const storedSourceDocumentLocalId = (
  row: SourceSlotProbeRow,
): string | undefined => {
  const content = row.reference_content;
  if (typeof content !== "object" || content === null || Array.isArray(content))
    return undefined;
  const conceptId = content[SOURCE_SLOT];
  if (typeof conceptId !== "number") return undefined;
  return (
    row.concepts_of_relation.find((concept) => concept.id === conceptId)
      ?.source_local_id ?? undefined
  );
};

const localIdOf = (sourceDocumentId: string): string =>
  isRid(sourceDocumentId)
    ? ridToSpaceUriAndLocalId(sourceDocumentId).sourceLocalId
    : sourceDocumentId;

// A relation added, accepted, or removed changes no note, so the stored slot is compared
// with the wanted one on full sync. The comparison is by local id: the database stores
// the Source's concept id, and an imported Source is wanted by its origin RID.
export const findStaleSourceSlotNodeIds = ({
  rows,
  sourceSlotByNodeId,
}: {
  rows: SourceSlotProbeRow[];
  sourceSlotByNodeId: Record<string, string>;
}): Set<string> => {
  const stale = new Set<string>();
  for (const row of rows) {
    if (row.source_local_id === null) continue;
    const wanted = sourceSlotByNodeId[row.source_local_id];
    const wantedLocalId = wanted === undefined ? undefined : localIdOf(wanted);
    if (wantedLocalId !== storedSourceDocumentLocalId(row))
      stale.add(row.source_local_id);
  }
  return stale;
};
