import React, { useEffect, useState } from "react";
import { Collapse, Spinner, Icon } from "@blueprintjs/core";
import { findSimilarNodes, SuggestedNode } from "~/utils/hyde";
import getDiscourseNodes, { DiscourseNode } from "~/utils/getDiscourseNodes";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import findDiscourseNode from "~/utils/findDiscourseNode";
import matchDiscourseNode from "~/utils/matchDiscourseNode";
import getDiscourseNodeFormatExpression from "~/utils/getDiscourseNodeFormatExpression";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";

const extractContentFromTitle = (
  title: string,
  node: DiscourseNode,
): string => {
  if (!node.format) return title;

  const placeholderRegex = /{([\w\d-]+)}/g;
  const placeholders: string[] = [];
  let placeholderMatch: RegExpExecArray | null = null;
  while ((placeholderMatch = placeholderRegex.exec(node.format))) {
    placeholders.push(placeholderMatch[1]);
  }

  const expression = getDiscourseNodeFormatExpression(node.format);
  const expressionMatch = expression.exec(title);
  if (!expressionMatch || expressionMatch.length <= 1) {
    return title;
  }

  const contentIndex = placeholders.findIndex(
    (name) => name.toLowerCase() === "content",
  );
  if (contentIndex >= 0) {
    return expressionMatch[contentIndex + 1]?.trim() || title;
  }

  return expressionMatch[1]?.trim() || title;
};

type NodeContext = {
  node: DiscourseNode;
  searchText: string;
  pageUid: string | null;
};

const PossibleDuplicates = ({ pageTitle }: { pageTitle: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedNode[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<
    SuggestedNode[]
  >([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [nodeContext, setNodeContext] = useState<NodeContext | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Check if this page matches a discourse node (runs on mount)
  useEffect(() => {
    const discourseNodes = getDiscourseNodes();

    const pageUid = getPageUidByPageTitle(pageTitle) || null;
    let matchedNode: DiscourseNode | null = null;

    if (pageUid) {
      const found = findDiscourseNode(pageUid, discourseNodes);
      if (found) {
        matchedNode = found;
      }
    }

    if (!matchedNode) {
      matchedNode =
        discourseNodes.find((node) =>
          matchDiscourseNode({ ...node, title: pageTitle }),
        ) || null;
    }

    if (matchedNode) {
      const searchText = extractContentFromTitle(pageTitle, matchedNode);
      setNodeContext({ node: matchedNode, searchText, pageUid });
    } else {
      setNodeContext(null);
    }
  }, [pageTitle]);

  // Only fetch suggestions when the card is opened
  useEffect(() => {
    let isCancelled = false;
    const fetchSuggestions = async () => {
      if (!isOpen || hasSearched) return;

      if (nodeContext && nodeContext.searchText.trim()) {
        const { node, searchText, pageUid } = nodeContext;
        setSuggestionsLoading(true);
        try {
          const { raw, filtered } = await findSimilarNodes({
            text: searchText,
            nodeType: node.type,
          });
          const normalize = (value: string) =>
            normalizePageTitle(value || "")
              .trim()
              .toLowerCase();
          const normalizedPageTitle = normalize(pageTitle);
          const normalizedSearchText = normalize(searchText);
          const filterOutCurrent = (items: SuggestedNode[]) =>
            items.filter((candidate) => {
              const sameUid = !!pageUid && candidate.uid === pageUid;
              const normalizedCandidateText = normalize(candidate.text);
              const sameTitle = normalizedCandidateText === normalizedPageTitle;
              const sameContent =
                normalizedCandidateText === normalizedSearchText;
              return !sameUid && !sameTitle && !sameContent;
            });
          if (!isCancelled) {
            const filteredRaw = filterOutCurrent(raw);
            const filteredFiltered = filterOutCurrent(filtered);
            setSuggestions(filteredRaw);
            setFilteredSuggestions(filteredFiltered);
            setSuggestionsLoading(false);
            setHasSearched(true);
          }
        } catch (error) {
          console.error("Error fetching duplicate suggestions:", error);
          if (!isCancelled) {
            setSuggestionsLoading(false);
          }
        }
      } else {
        if (!isCancelled) {
          setSuggestions([]);
          setFilteredSuggestions([]);
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

  // Don't show the card if there's no discourse node context
  if (!nodeContext) {
    return null;
  }

  const totalSuggestions = suggestions.length + filteredSuggestions.length;
  const hasSuggestions = totalSuggestions > 0;

  return (
    <div className="my-2 rounded border border-gray-200">
      <div
        className="flex cursor-pointer items-center justify-between p-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Icon icon={isOpen ? "chevron-down" : "chevron-right"} />
          <h5 className="m-0 font-semibold">
            Check for Potential Duplicates & Related Nodes
          </h5>
        </div>
        {hasSearched && !suggestionsLoading && hasSuggestions && (
          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs text-white">
            {totalSuggestions}
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
            <div className="flex flex-col gap-3">
              {filteredSuggestions.length > 0 && (
                <div>
                  <p className="mb-2 ml-2 text-xs font-semibold uppercase text-gray-500">
                    AI Filtered Potential Duplicates & Related Nodes
                  </p>
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
                </div>
              )}

              {suggestions.length > 0 && (
                <div>
                  <p className="mb-2 ml-2 text-xs font-semibold uppercase text-gray-500">
                    Plain Vector Search Matches
                  </p>
                  <ul className="flex flex-col gap-1">
                    {suggestions.map((node) => (
                      <li key={node.uid}>
                        <a
                          onClick={() => {
                            void handleSuggestionClick(node);
                          }}
                          className="cursor-pointer text-blue-600 opacity-70 hover:underline"
                        >
                          {node.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Collapse>
    </div>
  );
};

export default PossibleDuplicates;
