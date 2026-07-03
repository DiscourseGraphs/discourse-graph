import { useEffect, useMemo, useState } from "react";
import MiniSearch from "minisearch";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import {
  searchDiscourseNodesWithSemanticFallback,
  type DiscourseSearchHit,
} from "~/utils/discourseNodeSemanticSearch";
import {
  searchIndexedNodes,
  sortSearchResults,
  type SearchResult,
  type SortConfig,
} from "./utils";
import { isDockedSnapshot } from "./dockedSearchSnapshot";

export type SearchIndex = {
  miniSearch: MiniSearch<SearchResult & { id: string }>;
  allResults: SearchResult[];
};

type UseAdvancedNodeSearchResultsArgs = {
  debouncedSearchTerm: string;
  selectedNodeTypeIds: string[];
  sort: SortConfig;
  isIndexLoading: boolean;
  indexError: boolean;
  searchIndex: SearchIndex | null;
  dockedQuery?: string;
  dockedResults?: SearchResult[];
};

const toKeywordHits = (
  scoredHits: ReturnType<typeof searchIndexedNodes>,
): DiscourseSearchHit[] =>
  scoredHits.map((hit) => ({
    uid: hit.result.uid,
    text: hit.result.title,
    type: hit.result.type,
    nodeTypeLabel: hit.result.nodeTypeLabel,
    score: hit.score,
    source: "keyword" as const,
  }));

const hitsToScoredSearchHits = ({
  hits,
  resultsByUid,
}: {
  hits: DiscourseSearchHit[];
  resultsByUid: Map<string, SearchResult>;
}) =>
  hits
    .map((hit) => {
      const indexedResult = resultsByUid.get(hit.uid);
      if (indexedResult) {
        return { result: indexedResult, score: hit.score, source: hit.source };
      }

      return {
        result: {
          uid: hit.uid,
          title: hit.text,
          type: hit.type || "",
          nodeTypeLabel: hit.nodeTypeLabel || "",
          excerpt: "",
          createdAt: "",
          lastModified: "",
          authorName: "Unknown",
        },
        score: hit.score,
        source: hit.source,
      };
    })
    .filter(
      (
        hit,
      ): hit is {
        result: SearchResult;
        score: number;
        source: DiscourseSearchHit["source"];
      } => !!hit,
    );

export const useAdvancedNodeSearchResults = ({
  debouncedSearchTerm,
  selectedNodeTypeIds,
  sort,
  isIndexLoading,
  indexError,
  searchIndex,
  dockedQuery,
  dockedResults,
}: UseAdvancedNodeSearchResultsArgs): SearchResult[] => {
  const frozenSnapshot = useMemo(
    () =>
      isDockedSnapshot({
        debouncedSearchTerm,
        dockedQuery,
        dockedResults,
      }),
    [debouncedSearchTerm, dockedQuery, dockedResults],
  );

  const [liveResults, setLiveResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (frozenSnapshot) return;

    if (!debouncedSearchTerm) {
      setLiveResults([]);
      return;
    }

    if (isIndexLoading || indexError || !searchIndex) {
      setLiveResults([]);
      return;
    }

    let cancelled = false;
    const typeFilter = selectedNodeTypeIds.length
      ? selectedNodeTypeIds
      : undefined;
    const discourseNodes = getDiscourseNodes().filter(
      (node) =>
        node.backedBy === "user" &&
        (!typeFilter || typeFilter.includes(node.type)),
    );
    const resultsByUid = new Map(
      searchIndex.allResults.map((result) => [result.uid, result]),
    );

    const runKeywordSearch = (): DiscourseSearchHit[] =>
      toKeywordHits(
        searchIndexedNodes({
          miniSearch: searchIndex.miniSearch,
          allResults: searchIndex.allResults,
          searchTerm: debouncedSearchTerm,
          typeFilter,
        }),
      );

    void searchDiscourseNodesWithSemanticFallback({
      nodeTypes: discourseNodes,
      query: debouncedSearchTerm,
      runKeywordSearch,
    })
      .then((hits) => {
        if (cancelled) return;

        const scoredHits = hitsToScoredSearchHits({ hits, resultsByUid });
        setLiveResults(sortSearchResults({ hits: scoredHits, sort }));
      })
      .catch((error) => {
        console.error("Advanced node search failed:", error);
        if (cancelled) return;
        setLiveResults(
          sortSearchResults({
            hits: hitsToScoredSearchHits({
              hits: runKeywordSearch(),
              resultsByUid,
            }),
            sort,
          }),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    debouncedSearchTerm,
    frozenSnapshot,
    indexError,
    isIndexLoading,
    searchIndex,
    selectedNodeTypeIds,
    sort,
  ]);

  if (frozenSnapshot && dockedResults) {
    return dockedResults;
  }

  return liveResults;
};
