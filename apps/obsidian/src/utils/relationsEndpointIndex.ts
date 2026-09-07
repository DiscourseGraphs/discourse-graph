import type { RelationInstance } from "~/types";

/**
 * Groups relations by the ids at either end, so a lookup is a Map hit rather
 * than a scan. Self-relations are filed once, not twice.
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

/** Relations touching any of `endpointIds`, deduped: an imported node matches on two ids. */
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
