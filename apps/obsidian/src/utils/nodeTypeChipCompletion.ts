/** Ghost completion for the search modal's chips; prefix-only, as a substring match has no suffix to draw. */

/** A node type or a space — anything the chip input can complete and commit as a filter. */
export type ChipCompletionItem = { id: string; name: string };

/** Exact match beats the first partial, so a name that prefixes another stays reachable. */
export const getBestPrefixMatch = <TItem extends ChipCompletionItem>({
  items,
  query,
  excludedIds,
}: {
  items: TItem[];
  query: string;
  excludedIds: string[];
}): TItem | null => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return null;

  const excludedIdSet = new Set(excludedIds);
  const matches = items.filter(
    (item) =>
      !excludedIdSet.has(item.id) &&
      item.name.toLowerCase().startsWith(normalizedQuery),
  );
  if (!matches.length) return null;

  const exactMatch = matches.find(
    (item) => item.name.toLowerCase() === normalizedQuery,
  );
  return exactMatch ?? matches[0] ?? null;
};

export const getCompletionSuffix = ({
  bestPrefixMatch,
  query,
}: {
  bestPrefixMatch: ChipCompletionItem | null;
  query: string;
}): string => {
  if (!bestPrefixMatch) return "";
  const trimmedQuery = query.trim();
  const { name } = bestPrefixMatch;
  if (name.toLowerCase() === trimmedQuery.toLowerCase()) return "";
  return name.slice(trimmedQuery.length);
};
