import React, { useMemo } from "react";
import {
  type SearchResult,
  type NodeTypeConfig,
  splitWithHighlights,
  stripTypePrefix,
} from "./types";

type Props = {
  result: SearchResult;
  typeConfig: NodeTypeConfig | undefined;
  active: boolean;
  keywords: string[];
  onMouseEnter: () => void;
  onClick: () => void;
};

const ResultRow = ({
  result,
  typeConfig,
  active,
  keywords,
  onMouseEnter,
  onClick,
}: Props) => {
  const displayTitle = useMemo(
    () => stripTypePrefix(result.title),
    [result.title],
  );

  const titleSegments = useMemo(
    () => splitWithHighlights(displayTitle, keywords),
    [displayTitle, keywords],
  );

  const abbrev = typeConfig?.abbrev ?? result.type.slice(0, 3).toUpperCase();
  const badgeStyle = typeConfig?.badgeStyle ?? {};

  return (
    <div
      className={`dg-as-result ${active ? "active" : ""}`}
      role="option"
      aria-selected={active}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      <span
        className="dg-as-type-badge"
        style={{
          color: badgeStyle?.color,
          backgroundColor: badgeStyle?.backgroundColor,
          border: badgeStyle?.border,
          borderRadius: badgeStyle?.borderRadius,
        }}
      >
        {abbrev}
      </span>
      <span className="dg-as-result-title">
        {titleSegments.map((seg, i) =>
          seg.hit ? (
            <mark key={i}>{seg.text}</mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </span>
      {result.refs > 0 && <sup className="dg-as-ref-count">{result.refs}</sup>}
    </div>
  );
};

export default ResultRow;
