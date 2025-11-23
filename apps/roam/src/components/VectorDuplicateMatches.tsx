import React, { useEffect, useState } from "react";
import { Collapse, Spinner, Icon } from "@blueprintjs/core";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import type { VectorMatch } from "~/utils/hyde";
import type { Result } from "~/utils/types";
import { findSimilarNodesVectorOnly } from "~/utils/hyde";
import { useNodeContext } from "~/utils/useNodeContext";
import ReactDOM from "react-dom";

const VectorDuplicateMatches = ({ pageTitle }: { pageTitle: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [suggestions, setSuggestions] = useState<VectorMatch[]>([]);

  const nodeContext = useNodeContext(pageTitle);

  useEffect(() => {
    let isCancelled = false;
    const fetchSuggestions = async () => {
      if (!isOpen || hasSearched) return;
      if (!nodeContext || !nodeContext.searchText.trim()) return;

      const { searchText, pageUid } = nodeContext;

      setSuggestionsLoading(true);
      try {
        const raw: VectorMatch[] = await findSimilarNodesVectorOnly({
          text: searchText,
          threshold: 0.3,
          limit: 20,
        });
        const normalize = (value: string) =>
          normalizePageTitle(value || "")
            .trim()
            .toLowerCase();
        const normalizedPageTitle = normalize(pageTitle);
        const normalizedSearchText = normalize(searchText);
        const results: VectorMatch[] = raw.filter((candidate: VectorMatch) => {
          const sameUid = !!pageUid && candidate.node.uid === pageUid;
          const normalizedCandidateText = normalize(candidate.node.text);
          const sameTitle = normalizedCandidateText === normalizedPageTitle;
          const sameContent = normalizedCandidateText === normalizedSearchText;
          return !sameUid && !sameTitle && !sameContent;
        });
        if (!isCancelled) {
          setSuggestions(results);
          setSuggestionsLoading(false);
          setHasSearched(true);
        }
      } catch (error: unknown) {
        console.error("Error fetching vector duplicates:", error);
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

  const handleSuggestionClick = async (node: Result) => {
    await window.roamAlphaAPI.ui.mainWindow.openPage({
      page: { uid: node.uid },
    });
  };

  if (!nodeContext) {
    return null;
  }

  const hasSuggestions = suggestions.length > 0;

  return (
    <div className="my-2 rounded border border-gray-200">
      <div
        className="flex cursor-pointer items-center justify-between p-2"
        onClick={() => {
          setIsOpen(!isOpen);
        }}
      >
        <div className="flex items-center gap-2">
          <Icon icon={isOpen ? "chevron-down" : "chevron-right"} />
          <h5 className="m-0 font-semibold">Plain Vector Search Matches</h5>
        </div>
        {hasSearched && !suggestionsLoading && hasSuggestions && (
          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs text-white">
            {suggestions.length}
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
            <p className="py-2 text-sm text-gray-600">No matches found.</p>
          )}

          {!suggestionsLoading && hasSearched && hasSuggestions && (
            <ul className="flex flex-col gap-1">
              {suggestions.map((match) => (
                <li key={match.node.uid} className="flex items-start gap-2">
                  <a
                    onClick={() => {
                      void handleSuggestionClick(match.node);
                    }}
                    className="min-w-0 flex-1 cursor-pointer break-words text-blue-600 opacity-70 hover:underline"
                  >
                    {match.node.text}
                  </a>
                  <span className="ml-2 shrink-0 text-xs tabular-nums text-gray-500">
                    {match.score.toFixed(3)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Collapse>
    </div>
  );
};

export const renderPossibleDuplicates = (
  h1: HTMLHeadingElement,
  title: string,
) => {
  const titleContainer = h1.parentElement;
  if (!titleContainer || !titleContainer.parentElement) {
    return;
  }
  const headerContainer = titleContainer.parentElement;
  const VECTOR_CONTAINER_ID = "discourse-graph-duplicates-vector";

  let vectorContainer = document.getElementById(VECTOR_CONTAINER_ID);
  if (vectorContainer && vectorContainer.dataset.pageTitle !== title) {
    /*eslint-disable-next-line react/no-deprecated*/
    ReactDOM.unmountComponentAtNode(vectorContainer);
    /*eslint-disable-next-line react/no-deprecated*/
    vectorContainer.remove();
    vectorContainer = null;
  }
  if (!vectorContainer) {
    vectorContainer = document.createElement("div");
    vectorContainer.id = VECTOR_CONTAINER_ID;
    vectorContainer.dataset.pageTitle = title;
    vectorContainer.className = "w-full mt-2";

    headerContainer.insertBefore(vectorContainer, titleContainer.nextSibling);
  } else if (
    vectorContainer.parentElement !== headerContainer ||
    vectorContainer.previousElementSibling !== titleContainer
  ) {
    headerContainer.insertBefore(vectorContainer, titleContainer.nextSibling);
  }

  /*eslint-disable-next-line react/no-deprecated*/
  ReactDOM.render(
    React.createElement(VectorDuplicateMatches, { pageTitle: title }),
    vectorContainer,
  );
  /*eslint-disable-next-line react/no-deprecated*/
};
