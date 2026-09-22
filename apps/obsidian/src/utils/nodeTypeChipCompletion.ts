import { DiscourseNode } from "~/types";

/** Ghost completion for the search modal's chips; prefix-only, as a substring match has no suffix to draw. */

/** Exact match beats the first partial, so a name that prefixes another stays reachable. */
export const getBestPrefixMatch = ({
  nodeTypes,
  query,
  selectedTypeIds,
}: {
  nodeTypes: DiscourseNode[];
  query: string;
  selectedTypeIds: string[];
}): DiscourseNode | null => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return null;

  const selectedTypeIdSet = new Set(selectedTypeIds);
  const matches = nodeTypes.filter(
    (nodeType) =>
      !selectedTypeIdSet.has(nodeType.id) &&
      nodeType.name.toLowerCase().startsWith(normalizedQuery),
  );
  if (!matches.length) return null;

  const exactMatch = matches.find(
    (nodeType) => nodeType.name.toLowerCase() === normalizedQuery,
  );
  return exactMatch ?? matches[0] ?? null;
};

export const getCompletionSuffix = ({
  bestPrefixMatch,
  query,
}: {
  bestPrefixMatch: DiscourseNode | null;
  query: string;
}): string => {
  if (!bestPrefixMatch) return "";
  const trimmedQuery = query.trim();
  const { name } = bestPrefixMatch;
  if (name.toLowerCase() === trimmedQuery.toLowerCase()) return "";
  return name.slice(trimmedQuery.length);
};
