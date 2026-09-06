import type { RelationInstance } from "~/types";

/**
 * Pure indexing helpers behind RelationsIndex, kept free of Obsidian and
 * relationsStore imports so the grouping and dedupe rules stay separate from
 * snapshot loading and invalidation.
 */

/**
 * Groups relations by the node instance ids at either end, so a lookup by
 * endpoint is a Map hit instead of a scan over every relation in the vault.
 *
 * A relation is filed under both its source and its destination. Self-relations
 * (source === destination) are filed once so a single endpoint never yields the
 * same relation twice.
 */
export const buildEndpointIndex = (
  relations: Record<string, RelationInstance>,
): Map<string, RelationInstance[]> => {
  const index = new Map<string, RelationInstance[]>();

  const fileUnder = (endpointId: string, relation: RelationInstance): void => {
    const existing = index.get(endpointId);
    if (existing) {
      existing.push(relation);
      return;
    }
    index.set(endpointId, [relation]);
  };

  for (const relation of Object.values(relations)) {
    if (!relation) continue;
    if (relation.source) fileUnder(relation.source, relation);
    if (relation.destination && relation.destination !== relation.source) {
      fileUnder(relation.destination, relation);
    }
  }

  return index;
};

/**
 * Returns every relation touching any of `endpointIds`, deduplicated by id.
 *
 * A relation whose source and destination are both in `endpointIds` — which
 * happens for an imported node matched by both its nodeInstanceId and its
 * importedFromRid — must still be counted once.
 */
export const collectRelations = ({
  index,
  endpointIds,
}: {
  index: Map<string, RelationInstance[]>;
  endpointIds: Iterable<string>;
}): RelationInstance[] => {
  const seen = new Set<string>();
  const collected: RelationInstance[] = [];

  for (const endpointId of endpointIds) {
    const relations = index.get(endpointId);
    if (!relations) continue;
    for (const relation of relations) {
      if (seen.has(relation.id)) continue;
      seen.add(relation.id);
      collected.push(relation);
    }
  }

  return collected;
};
