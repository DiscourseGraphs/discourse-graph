import React, { useEffect, useState, useMemo } from "react";
import { Collapse, Spinner, Icon } from "@blueprintjs/core";
import {
  findSimilarNodesVectorOnly as vectorSearch,
  type VectorMatch,
} from "~/utils/hyde";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import extractContentFromTitle from "~/utils/extractContentFromTitle";
import { handleTitleAdditions } from "~/utils/handleTitleAdditions";
import posthog from "posthog-js";

export const VectorDuplicateMatches = ({
  pageTitle,
  text,
  limit = 15,
  node,
}: {
  pageTitle?: string;
  text?: string;
  limit?: number;
  node: DiscourseNode;
}) => {
  const [debouncedText, setDebouncedText] = useState(text);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedText(text);
    }, 500);
    return () => {
      clearTimeout(handler);
    };
  }, [text]);

  const [isOpen, setIsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [suggestions, setSuggestions] = useState<VectorMatch[]>([]);

  const searchText = extractContentFromTitle(pageTitle || "", node);
  const pageUid = getPageUidByPageTitle(searchText);
  const activeContext = useMemo(
    () =>
      text !== undefined
        ? { searchText: debouncedText || "", pageUid: null }
        : { searchText, pageUid },
    [text, debouncedText, searchText, pageUid],
  );

  useEffect(() => {
    setHasSearched(false);
  }, [activeContext?.searchText]);

  useEffect(() => {
    let isCancelled = false;
    const fetchSuggestions = async () => {
      if (!isOpen || hasSearched) return;
      if (!activeContext || !activeContext.searchText.trim()) return;

      const { searchText, pageUid } = activeContext;

      setSuggestionsLoading(true);
      try {
        const raw = await vectorSearch({
          text: searchText,
          threshold: 0.3,
          limit,
        });
        const results: VectorMatch[] = raw.filter((candidate) => {
          const sameUid = !!pageUid && candidate.node.uid === pageUid;
          return !sameUid;
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
  }, [isOpen, hasSearched, activeContext, pageTitle, limit]);

  const handleSuggestionClick = async (node: VectorMatch["node"]) => {
    await window.roamAlphaAPI.ui.rightSidebar.addWindow({
      window: {
        type: "outline",
        // @ts-expect-error - type definition mismatch
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "block-uid": node.uid,
      },
    });
  };

  if (!activeContext) {
    return null;
  }

  const hasSuggestions = suggestions.length > 0;

  return (
    <div className="my-2 rounded border border-gray-200">
      <div
        className="flex cursor-pointer items-center justify-between p-2"
        onClick={() => {
          setIsOpen((prev) => {
            const next = !prev;
            posthog.capture("Possible Duplicates: Toggled", {
              isOpen: next,
            });
            return next;
          });
        }}
      >
        <div className="flex items-center gap-2">
          <Icon icon={isOpen ? "chevron-down" : "chevron-right"} />
          <h5 className="m-0 font-semibold">Possible Duplicates</h5>
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
  node: DiscourseNode,
) => {
  handleTitleAdditions(
    h1,
    <VectorDuplicateMatches pageTitle={title} node={node} />,
  );
};
