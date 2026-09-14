import { prepareFuzzySearch } from "obsidian";
import type { SpaceOption } from "~/utils/remoteSpaceCandidates";

/** Space filtering for the search modal, mirroring `discourseNodeTypeFilter.ts`'s node-type filtering. */

export const hasActiveSpaceFilter = (selectedSpaceIds: string[]): boolean =>
  selectedSpaceIds.length > 0;

/** Fuzzy-matched and best-match-first, same scorer `filterNodeTypesByQuery` uses. */
export const filterSpacesByQuery = (
  spaces: SpaceOption[],
  query: string,
): SpaceOption[] => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return spaces;

  const score = prepareFuzzySearch(trimmedQuery);
  return spaces
    .flatMap((space) => {
      const match = score(space.name);
      return match ? [{ space, score: match.score }] : [];
    })
    .sort((a, b) => b.score - a.score)
    .map(({ space }) => space);
};
