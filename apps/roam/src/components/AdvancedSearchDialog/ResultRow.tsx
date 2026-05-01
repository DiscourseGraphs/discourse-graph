import React, { useMemo } from "react";
import {
  type SearchResult,
  type NodeTypeConfig,
  splitWithHighlights,
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
  const titleSegments = useMemo(
    () => splitWithHighlights(result.title, keywords),
    [result.title, keywords],
  );

  const badgeColor = typeConfig?.color ?? "#8E8E8E";
  const abbrev = typeConfig?.abbrev ?? result.type.slice(0, 3).toUpperCase();

  return (
    <div
      className={`dg-as-result${active ? "active" : ""}`}
      role="option"
      aria-selected={active}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      <span
        className="dg-as-type-badge"
        style={{ background: badgeColor }}
        title={typeConfig?.label}
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
