import MiniSearch from "minisearch";
import { type DiscourseNode } from "~/utils/getDiscourseNodes";
import {
  DISCOURSE_NODE_MIN_SEARCH_SCORE,
  DISCOURSE_NODE_MINI_SEARCH_OPTIONS,
  DISCOURSE_NODE_SEARCH_METADATA_PULL,
  getPulledDiscourseNodeAuthorName,
  getPulledDiscourseNodeTitle,
  getPulledDiscourseNodeUid,
  queryDiscourseNodesByFormat,
} from "~/utils/discourseNodeSearch";

export const DEBOUNCE_MS = 250;
export const MAX_RESULTS = 50;

export const getSearchKeywords = (searchTerm: string): string[] =>
  searchTerm.split(/\s+/).filter(Boolean);

export type SortField = "relevance" | "alphabetical" | "dateCreated" | "author";
export type SortDirection = "asc" | "desc";

export type SortConfig = {
  field: SortField;
  direction: SortDirection;
};

export const DEFAULT_SORT_CONFIG: SortConfig = {
  field: "relevance",
  direction: "desc",
};

export const SORT_FIELD_LABELS: Record<SortField, string> = {
  relevance: "Relevance",
  alphabetical: "Alphabetical",
  dateCreated: "Date created",
  author: "Author",
};

export type SearchResult = {
  uid: string;
  title: string;
  type: string;
  nodeTypeLabel: string;
  excerpt: string;
  createdAt: string;
  lastModified: string;
  authorName: string;
};

export type ScoredSearchHit = {
  result: SearchResult;
  score: number;
};

type MiniSearchDocument = SearchResult & {
  id: string;
};

export const formatMetadataDate = (value: string): string => {
  if (!value) return "Unknown";
  const numericValue = Number(value);
  const date = Number.isFinite(numericValue)
    ? new Date(numericValue)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const stripTypePrefix = (title: string): string => {
  const match = title.match(/^\[\[.*?\]\]\s*-\s*(.*)/s);
  return match ? match[1] : title;
};

export const splitWithHighlights = (
  text: string,
  keywords: string[],
): { text: string; isMatch: boolean }[] => {
  if (!keywords.length) return [{ text, isMatch: false }];

  const escapedKeywords = keywords.map((keyword) =>
    keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const regex = new RegExp(`(${escapedKeywords.join("|")})`, "gi");
  const loweredKeywords = new Set(
    keywords.map((keyword) => keyword.toLowerCase()),
  );

  return text
    .split(regex)
    .filter(Boolean)
    .map((part) => ({
      text: part,
      isMatch: loweredKeywords.has(part.toLowerCase()),
    }));
};

const queryNodesForType = async (
  node: DiscourseNode,
): Promise<SearchResult[]> => {
  try {
    const pulledNodes = await queryDiscourseNodesByFormat({
      node,
      pullExpression: DISCOURSE_NODE_SEARCH_METADATA_PULL,
    });

    return pulledNodes
      .map((result) => {
        const uid = getPulledDiscourseNodeUid(result);
        const title = getPulledDiscourseNodeTitle(result);
        if (!uid || !title) return null;

        return {
          uid,
          title,
          type: node.type,
          nodeTypeLabel: node.text,
          excerpt: "",
          createdAt: String(result[":create/time"] || ""),
          lastModified: String(
            result[":edit/time"] || result[":create/time"] || "",
          ),
          authorName: getPulledDiscourseNodeAuthorName(result),
        };
      })
      .filter((result): result is SearchResult => !!result);
  } catch (error) {
    console.error(`Error querying for node type ${node.type}:`, error);
    throw error;
  }
};

export const buildSearchIndex = async (
  discourseNodes: DiscourseNode[],
): Promise<{
  miniSearch: MiniSearch<MiniSearchDocument>;
  results: SearchResult[];
}> => {
  const resultsByType = await Promise.allSettled(
    discourseNodes.map(queryNodesForType),
  );

  const rejected = resultsByType.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (discourseNodes.length > 0 && rejected.length === discourseNodes.length) {
    throw (
      rejected[0]?.reason ??
      new Error("Failed to build advanced node search index")
    );
  }

  const results: SearchResult[] = [];
  const seenUids = new Set<string>();
  for (const resultByType of resultsByType) {
    if (resultByType.status !== "fulfilled") continue;
    for (const result of resultByType.value) {
      if (seenUids.has(result.uid)) continue;
      seenUids.add(result.uid);
      results.push(result);
    }
  }

  const miniSearch = new MiniSearch<MiniSearchDocument>({
    fields: ["title", "nodeTypeLabel"],
    storeFields: ["uid", "title", "type", "nodeTypeLabel", "excerpt"],
    idField: "id",
  });

  miniSearch.addAll(results.map((result) => ({ ...result, id: result.uid })));

  return { miniSearch, results };
};

const compareNumbers = (
  a: number,
  b: number,
  direction: SortDirection,
): number => (direction === "desc" ? b - a : a - b);

const compareStrings = (
  a: string,
  b: string,
  direction: SortDirection,
): number => {
  const comparison = a.localeCompare(b, undefined, { sensitivity: "base" });
  return direction === "desc" ? -comparison : comparison;
};

const getSortableTitle = (result: SearchResult): string =>
  stripTypePrefix(result.title);

const getCreatedTime = (result: SearchResult): number =>
  Number(result.createdAt) || 0;

export const isNonDefaultSort = (sort: SortConfig): boolean =>
  sort.field !== DEFAULT_SORT_CONFIG.field ||
  sort.direction !== DEFAULT_SORT_CONFIG.direction;

export const sortSearchResults = ({
  hits,
  sort,
}: {
  hits: ScoredSearchHit[];
  sort: SortConfig;
}): SearchResult[] => {
  const sorted = [...hits];

  sorted.sort((aHit, bHit) => {
    const a = aHit.result;
    const b = bHit.result;
    let comparison = 0;

    switch (sort.field) {
      case "relevance":
        comparison = compareNumbers(aHit.score, bHit.score, sort.direction);
        break;
      case "alphabetical":
        comparison = compareStrings(
          getSortableTitle(a),
          getSortableTitle(b),
          sort.direction,
        );
        break;
      case "dateCreated":
        comparison = compareNumbers(
          getCreatedTime(a),
          getCreatedTime(b),
          sort.direction,
        );
        break;
      case "author": {
        const aAuthor = a.authorName.trim();
        const bAuthor = b.authorName.trim();
        if (!aAuthor && !bAuthor) comparison = 0;
        else if (!aAuthor) comparison = 1;
        else if (!bAuthor) comparison = -1;
        else comparison = compareStrings(aAuthor, bAuthor, sort.direction);
        break;
      }
    }

    return comparison || a.uid.localeCompare(b.uid);
  });

  return sorted.map((hit) => hit.result);
};

export const searchIndexedNodes = ({
  miniSearch,
  allResults,
  searchTerm,
  typeFilter,
}: {
  miniSearch: MiniSearch<MiniSearchDocument>;
  allResults: SearchResult[];
  searchTerm: string;
  typeFilter?: string[];
}): ScoredSearchHit[] => {
  const resultsByUid = new Map(
    allResults.map((result) => [result.uid, result]),
  );
  const allowedTypes = typeFilter?.length ? new Set(typeFilter) : null;

  return miniSearch
    .search(searchTerm, {
      fields: ["title", "nodeTypeLabel"],
      ...DISCOURSE_NODE_MINI_SEARCH_OPTIONS,
      filter: allowedTypes
        ? (result) => allowedTypes.has(String(result.type))
        : undefined,
    })
    .filter((result) => result.score > DISCOURSE_NODE_MIN_SEARCH_SCORE)
    .slice(0, MAX_RESULTS)
    .map((result) => {
      const searchResult = resultsByUid.get(String(result.id));
      if (!searchResult) return null;
      return { result: searchResult, score: result.score };
    })
    .filter((hit): hit is ScoredSearchHit => !!hit);
};
