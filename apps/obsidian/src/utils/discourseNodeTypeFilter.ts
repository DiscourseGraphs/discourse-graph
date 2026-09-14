import { prepareFuzzySearch } from "obsidian";
import { DiscourseNode } from "~/types";

/**
 * Node type filtering for the search modal. An empty `selectedTypeIds` means no
 * filter, matching `filterCandidatesByNodeTypeIds` in QueryEngine — so nothing
 * checked shows every node, and checking a type narrows results to it.
 * Ported from Roam's advanced search so both apps filter alike.
 */

export const hasActiveTypeFilter = (selectedTypeIds: string[]): boolean =>
  selectedTypeIds.length > 0;

/** Fuzzy-matched and best-match-first, same scorer `rankDiscourseNodesByTitle` uses for results. */
export const filterNodeTypesByQuery = (
  nodeTypes: DiscourseNode[],
  query: string,
): DiscourseNode[] => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return nodeTypes;

  const score = prepareFuzzySearch(trimmedQuery);
  return nodeTypes
    .flatMap((nodeType) => {
      const match = score(nodeType.name);
      return match ? [{ nodeType, score: match.score }] : [];
    })
    .sort((a, b) => b.score - a.score)
    .map(({ nodeType }) => nodeType);
};
