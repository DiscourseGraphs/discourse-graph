import React, { useEffect, useState } from "react";
import { Collapse, Spinner, Icon } from "@blueprintjs/core";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import type { SuggestedNode, VectorMatch } from "~/utils/hyde";
import { filterCandidatesByLlm } from "~/utils/hyde";
import { getCachedVectorMatches } from "~/utils/similarNodesCache";
import { useNodeContext } from "~/utils/useNodeContext";

const LlmFilteredDuplicates = ({ pageTitle }: { pageTitle: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<
    SuggestedNode[]
  >([]);

  const nodeContext = useNodeContext(pageTitle);

  useEffect(() => {
    let isCancelled = false;
    const fetchSuggestions = async () => {
      if (!isOpen || hasSearched) return;
      if (!nodeContext || !nodeContext.searchText.trim()) return;

      const { node, searchText, pageUid } = nodeContext;
      setSuggestionsLoading(true);
      try {
        const vectorCandidates: VectorMatch[] = await getCachedVectorMatches({
          text: searchText,
          nodeType: node.type,
        });
        const filtered = await filterCandidatesByLlm({
          originalText: searchText,
          candidates: vectorCandidates.map((m) => m.node),
        });
        const normalize = (value: string) =>
          normalizePageTitle(value || "")
            .trim()
            .toLowerCase();
        const normalizedPageTitle = normalize(pageTitle);
        const normalizedSearchText = normalize(searchText);
        const results = filtered.filter((candidate) => {
          const sameUid = !!pageUid && candidate.uid === pageUid;
          const normalizedCandidateText = normalize(candidate.text);
          const sameTitle = normalizedCandidateText === normalizedPageTitle;
          const sameContent = normalizedCandidateText === normalizedSearchText;
          return !sameUid && !sameTitle && !sameContent;
        });
        if (!isCancelled) {
          setFilteredSuggestions(results);
          setSuggestionsLoading(false);
          setHasSearched(true);
        }
      } catch (e) {
        console.error("Error fetching LLM filtered duplicates:", e);
        if (!isCancelled) {
          setSuggestionsLoading(false);
        }
      }
    };
    void fetchSuggestions();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, hasSearched, nodeContext, pageTitle]);

  const handleSuggestionClick = async (node: SuggestedNode) => {
    await window.roamAlphaAPI.ui.mainWindow.openPage({
      page: { uid: node.uid },
    });
  };

  if (!nodeContext) {
    return null;
  }

  const hasSuggestions = filteredSuggestions.length > 0;

  return (
    <div className="my-2 rounded border border-gray-200">
      <div
        className="flex cursor-pointer items-center justify-between p-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Icon icon={isOpen ? "chevron-down" : "chevron-right"} />
          <h5 className="m-0 font-semibold">
            AI Filtered Potential Duplicates & Related Nodes
          </h5>
        </div>
        {hasSearched && !suggestionsLoading && hasSuggestions && (
          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs text-white">
            {filteredSuggestions.length}
          </span>
        )}
      </div>

      <Collapse isOpen={isOpen}>
        <div className="border-t border-gray-200 p-2">
          {suggestionsLoading && (
            <div className="ml-2 flex items-center gap-2 py-4">
              <Spinner size={20} />
              <span className="text-sm text-gray-600">
                Searching for duplicates...
              </span>
            </div>
          )}

          {!suggestionsLoading && hasSearched && !hasSuggestions && (
            <p className="py-2 text-sm text-gray-600">
              No duplicates or related nodes found.
            </p>
          )}

          {!suggestionsLoading && hasSearched && hasSuggestions && (
            <ul className="flex flex-col gap-1">
              {filteredSuggestions.map((node) => (
                <li key={node.uid}>
                  <a
                    onClick={() => {
                      void handleSuggestionClick(node);
                    }}
                    className="cursor-pointer text-blue-600 hover:underline"
                  >
                    {node.text}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Collapse>
    </div>
  );
};

export default LlmFilteredDuplicates;
