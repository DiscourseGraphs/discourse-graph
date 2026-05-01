import React, { useState, useEffect, useRef } from "react";
import {
  type SearchResult,
  type NodeTypeConfig,
  splitWithHighlights,
} from "./types";

type PulledBlock = {
  ":block/string"?: string;
  ":block/order"?: number;
  ":block/children"?: PulledBlock[];
};

type PulledPage = {
  ":node/title"?: string;
  ":block/children"?: PulledBlock[];
};

const fetchCurrentGraphContent = (uid: string): string[] => {
  try {
    const pulled = window.roamAlphaAPI.pull(
      "[:node/title {:block/children [:block/string :block/order]}]",
      [":block/uid", uid],
    ) as PulledPage | null;

    if (!pulled) return [];

    return (pulled[":block/children"] ?? [])
      .sort((a, b) => (a[":block/order"] ?? 0) - (b[":block/order"] ?? 0))
      .slice(0, 8)
      .map((b) => b[":block/string"] ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
};

type Props = {
  result: SearchResult | null;
  typeConfig: NodeTypeConfig | null;
  keywords: string[];
};

const PreviewPane = ({ result, typeConfig, keywords }: Props) => {
  const [richContent, setRichContent] = useState<string[] | null>(null);
  const contentCache = useRef<Map<string, string[]>>(new Map());

  useEffect(() => {
    setRichContent(null);
    if (!result?.fromCurrentGraph) return;

    if (contentCache.current.has(result.uid)) {
      setRichContent(contentCache.current.get(result.uid)!);
      return;
    }

    // Debounce 80ms — avoids firing on fast arrow-key navigation
    const timer = setTimeout(() => {
      const content = fetchCurrentGraphContent(result.uid);
      contentCache.current.set(result.uid, content);
      setRichContent(content);
    }, 80);

    return () => clearTimeout(timer);
  }, [result?.uid, result?.fromCurrentGraph]);

  if (!result || !typeConfig) {
    return (
      <div className="dg-as-preview-panel dg-as-preview-empty">
        <span>Select a result to preview</span>
      </div>
    );
  }

  const displayContent = richContent ?? [];
  const titleSegments = splitWithHighlights(result.title, keywords);

  const formattedDate = (() => {
    try {
      return new Date(result.lastModified).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return result.lastModified;
    }
  })();

  return (
    <div className="dg-as-preview-panel">
      <span
        className="dg-as-type-badge dg-as-preview-badge"
        style={{ background: typeConfig.color }}
      >
        {typeConfig.abbrev}
      </span>

      <h2 className="dg-as-preview-title">
        {titleSegments.map((seg, i) =>
          seg.hit ? (
            <mark key={i}>{seg.text}</mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
        {result.refs > 0 && (
          <sup className="dg-as-ref-count"> {result.refs}</sup>
        )}
      </h2>

      <div className="dg-as-preview-body">
        {displayContent.length > 0 ? (
          displayContent.map((line, i) => (
            <p key={i}>
              {splitWithHighlights(line, keywords).map((seg, j) =>
                seg.hit ? (
                  <mark key={j}>{seg.text}</mark>
                ) : (
                  <span key={j}>{seg.text}</span>
                ),
              )}
            </p>
          ))
        ) : (
          <span className="dg-as-preview-body-empty">
            {result.fromCurrentGraph
              ? "No content"
              : "Open this node to view its content"}
          </span>
        )}
      </div>

      <div className="dg-as-preview-meta">
        Last edited: {formattedDate} · {result.authorName}
        {!result.fromCurrentGraph && (
          <div className="dg-as-preview-cross-graph">
            From another graph — open to view full content
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPane;
