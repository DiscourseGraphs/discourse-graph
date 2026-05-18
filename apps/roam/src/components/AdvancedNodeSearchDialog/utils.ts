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

type MiniSearchDocument = SearchResult & {
  id: string;
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
  const results = resultsByType
    .filter(
      (r): r is PromiseFulfilledResult<SearchResult[]> =>
        r.status === "fulfilled",
    )
    .flatMap((r) => r.value);

  const miniSearch = new MiniSearch<MiniSearchDocument>({
    fields: ["title", "nodeTypeLabel"],
    storeFields: ["uid", "title", "type", "nodeTypeLabel", "excerpt"],
    idField: "id",
  });

  miniSearch.addAll(results.map((result) => ({ ...result, id: result.uid })));

  return { miniSearch, results };
};

export const searchIndexedNodes = ({
  miniSearch,
  allResults,
  searchTerm,
}: {
  miniSearch: MiniSearch<MiniSearchDocument>;
  allResults: SearchResult[];
  searchTerm: string;
}): SearchResult[] => {
  const resultsByUid = new Map(
    allResults.map((result) => [result.uid, result]),
  );

  return miniSearch
    .search(searchTerm, {
      fields: ["title", "nodeTypeLabel"],
      ...DISCOURSE_NODE_MINI_SEARCH_OPTIONS,
    })
    .filter((result) => result.score > DISCOURSE_NODE_MIN_SEARCH_SCORE)
    .slice(0, MAX_RESULTS)
    .map((result) => resultsByUid.get(String(result.id)))
    .filter((result): result is SearchResult => !!result);
};
