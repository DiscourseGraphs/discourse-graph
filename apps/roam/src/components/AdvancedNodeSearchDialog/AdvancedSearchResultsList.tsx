import React from "react";
import { Button, Icon, Tag } from "@blueprintjs/core";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import { getNodeTagStyles } from "~/utils/getDiscourseNodeColors";
import {
  type SearchResult,
  splitWithHighlights,
  stripTypePrefix,
} from "./utils";
import { openSearchResultFromLinkEvent } from "./openSearchResult";

const getNodeBadgeText = (node: DiscourseNode): string =>
  (node.tag?.trim() || node.text).slice(0, 3).toUpperCase();

const getTagStyle = (node: DiscourseNode | undefined): React.CSSProperties => {
  const color = node?.canvasSettings?.color;
  if (!color) return {};
  return getNodeTagStyles(color) ?? {};
};

export const renderHighlightedText = (
  text: string,
  keywords: string[],
): React.ReactNode =>
  splitWithHighlights(text, keywords).map((segment, index) =>
    segment.isMatch ? (
      <mark key={`${segment.text}-${index}`}>{segment.text}</mark>
    ) : (
      <React.Fragment key={`${segment.text}-${index}`}>
        {segment.text}
      </React.Fragment>
    ),
  );

type AdvancedSearchDialogResultsListProps = {
  activeIndex: number;
  keywords: string[];
  nodeConfigByType: Record<string, DiscourseNode>;
  onSelect: (index: number) => void;
  results: SearchResult[];
};

export const AdvancedSearchDialogResultsList = ({
  activeIndex,
  keywords,
  nodeConfigByType,
  onSelect,
  results,
}: AdvancedSearchDialogResultsListProps) => (
  <>
    {results.map((result, index) => (
      <Button
        alignText="left"
        aria-selected={index === activeIndex}
        className="flex-none !items-start gap-2 !px-3 !py-2"
        fill
        key={result.uid}
        minimal
        onClick={() => onSelect(index)}
        onMouseEnter={() => onSelect(index)}
        role="option"
        style={{
          background:
            index === activeIndex ? "rgba(95, 87, 192, 0.08)" : undefined,
          boxShadow:
            index === activeIndex ? "inset 3px 0 0 #5f57c0" : undefined,
        }}
      >
        <Tag
          className="shrink-0"
          minimal
          style={getTagStyle(nodeConfigByType[result.type])}
        >
          {nodeConfigByType[result.type]
            ? getNodeBadgeText(nodeConfigByType[result.type])
            : result.nodeTypeLabel}
        </Tag>
        <span className="min-w-0 break-words text-sm leading-snug text-gray-900">
          {renderHighlightedText(stripTypePrefix(result.title), keywords)}
        </span>
      </Button>
    ))}
  </>
);

type AdvancedSearchSidebarResultsListProps = {
  keywords: string[];
  results: SearchResult[];
};

export const AdvancedSearchSidebarResultsList = ({
  keywords,
  results,
}: AdvancedSearchSidebarResultsListProps) => (
  <div className="rm-search-query-content">
    {results.map((result) => {
      const displayTitle = stripTypePrefix(result.title);
      const pageTitle = getPageTitleByPageUid(result.uid) || displayTitle;

      return (
        <div
          className="rm-search-query__page-row dont-focus-block"
          key={result.uid}
        >
          <Icon
            className="rm-search-query__page-row-icon"
            icon="document"
            iconSize={16}
          />
          <span className="rm-search-query__page-row-title">
            <a
              className="rm-page-ref rm-page-ref--link"
              data-link-title={pageTitle}
              data-link-uid={result.uid}
              href={getRoamUrl(result.uid)}
              onMouseDown={(event) => {
                if (event.shiftKey) {
                  event.preventDefault();
                  event.stopPropagation();
                  void openSearchResultFromLinkEvent({
                    uid: result.uid,
                    shiftKey: true,
                  });
                }
              }}
              onClick={(event) => {
                if (event.shiftKey) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
            >
              <span className="rm-page__title cursor-pointer">
                {renderHighlightedText(displayTitle, keywords)}
              </span>
            </a>
          </span>
        </div>
      );
    })}
  </div>
);
