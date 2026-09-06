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

// Appended to a my_concepts select that already carries source_local_id.
export const SOURCE_SLOT_PROBE_SELECT =
  "reference_content, concepts_of_relation(id, space_id, source_local_id)";

export type SourceSlotProbeRow = {
  reference_content: Json | null;
  concepts_of_relation: {
    id: number | null;
    space_id: number | null;
    source_local_id: string | null;
  }[];
};

type StoredSourceDocument = {
  spaceId: number | null;
  localId: string | null;
};

const storedSourceDocumentOf = (
  row: SourceSlotProbeRow,
): StoredSourceDocument | undefined => {
  const content = row.reference_content;
  if (typeof content !== "object" || content === null || Array.isArray(content))
    return undefined;
  const conceptId = content[SOURCE_SLOT];
  if (typeof conceptId !== "number") return undefined;
  const concept = row.concepts_of_relation.find(
    (candidate) => candidate.id === conceptId,
  );
  if (!concept) return undefined;
  return { spaceId: concept.space_id, localId: concept.source_local_id };
};

const storedMatchesWanted = ({
  stored,
  wanted,
  spaceId,
}: {
  stored: StoredSourceDocument | undefined;
  wanted: string | undefined;
  spaceId: number;
}): boolean => {
  if (wanted === undefined) return stored === undefined;
  if (stored === undefined) return false;
  if (isRid(wanted))
    return (
      stored.spaceId !== spaceId &&
      stored.localId === ridToSpaceUriAndLocalId(wanted).sourceLocalId
    );
  return stored.spaceId === spaceId && stored.localId === wanted;
};

// A relation added, accepted, or removed changes no file, so the mtime check never
// fires; full sync compares the stored slot with the wanted one instead. The database
// stores the Source's concept id: a local Source must resolve to a concept in this
// space, an imported Source (wanted by its origin RID) to one in another space.
export const findStaleSourceSlotNodeIds = ({
  rows,
  sourceSlotByNodeId,
  spaceId,
}: {
  rows: (SourceSlotProbeRow & { source_local_id: string | null })[];
  sourceSlotByNodeId: Record<string, string>;
  spaceId: number;
}): Set<string> => {
  const stale = new Set<string>();
  for (const row of rows) {
    if (row.source_local_id === null) continue;
    const matches = storedMatchesWanted({
      stored: storedSourceDocumentOf(row),
      wanted: sourceSlotByNodeId[row.source_local_id],
      spaceId,
    });
    if (!matches) stale.add(row.source_local_id);
  }
  return stale;
};
