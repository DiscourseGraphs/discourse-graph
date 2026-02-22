"use client";

import { useCallback, useMemo, useState } from "react";
import { NODE_TYPES, NODE_TYPE_LABELS } from "~/types/extraction";
import type { ExtractionResult, NodeType } from "~/types/extraction";
import { formatNodesForClipboard } from "~/utils/ai/formatClipboard";
import { NodeCard } from "./NodeCard";
import { TypeTabs } from "./TypeTabs";

type ResultsPanelProps = {
  result: ExtractionResult;
};

type IndexedNode = {
  node: ExtractionResult["nodes"][number];
  index: number;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ResultsPanel = ({ result }: ResultsPanelProps) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    () => new Set(result.nodes.keys()),
  );
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | NodeType>("all");

  const allSelected = selectedIndices.size === result.nodes.length;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIndices(new Set());
      return;
    }

    setSelectedIndices(new Set(result.nodes.keys()));
  }, [allSelected, result.nodes]);

  const toggleNode = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleCopy = useCallback(() => {
    const selected = result.nodes.filter(
      (node, index) => Boolean(node) && selectedIndices.has(index),
    );
    const text = formatNodesForClipboard(selected);

    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result.nodes, selectedIndices]);

  const groupedNodes = useMemo(() => {
    const groups: { type: NodeType; nodes: IndexedNode[] }[] = [];

    for (const type of NODE_TYPES) {
      const matching = result.nodes
        .map((node, index) => ({ node, index }))
        .filter(({ node }) => node.type === type);

      if (matching.length > 0) {
        groups.push({ type, nodes: matching });
      }
    }

    return groups;
  }, [result.nodes]);

  const filteredNodes = useMemo(() => {
    if (activeTab === "all") {
      return null;
    }

    return result.nodes
      .map((node, index) => ({ node, index }))
      .filter(({ node }) => node.type === activeTab);
  }, [activeTab, result.nodes]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
      {(result.paperTitle || result.paperAuthors?.length) && (
        <div className="relative shrink-0 border-b border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] px-4 py-4 lg:px-5">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,#0ea5e9_0%,#22d3ee_45%,#34d399_100%)]" />
          {result.paperTitle && (
            <h2 className="text-[24px] font-semibold tracking-[-0.024em] text-slate-900">
              {result.paperTitle}
            </h2>
          )}
          {result.paperAuthors?.length ? (
            <p className="mt-1 text-[15px] text-slate-500">
              {result.paperAuthors.join(", ")}
            </p>
          ) : null}
        </div>
      )}

      <TypeTabs
        result={result}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="flex-1 overflow-y-auto bg-[radial-gradient(120%_100%_at_50%_0%,#f8fbff_0%,#f8fafc_52%,#f3f7fb_100%)] p-4 lg:p-5">
        {activeTab === "all" ? (
          <div className="space-y-6">
            {groupedNodes.map(({ type, nodes }) => (
              <div key={type}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    {NODE_TYPE_LABELS[type]}s
                  </h3>
                  <span className="text-[13px] font-semibold tabular-nums text-slate-400">
                    {nodes.length}
                  </span>
                  <span className="h-px flex-1 bg-slate-200" />
                </div>

                <div className="space-y-2.5">
                  {nodes.map(({ node, index }) => (
                    <NodeCard
                      key={index}
                      node={node}
                      selected={selectedIndices.has(index)}
                      onToggle={() => toggleNode(index)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredNodes?.map(({ node, index }) => (
              <NodeCard
                key={index}
                node={node}
                selected={selectedIndices.has(index)}
                onToggle={() => toggleNode(index)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200/85 bg-white/95 px-4 py-3.5 backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:px-5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleAll}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[14px] font-semibold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50"
          >
            {allSelected ? "Deselect All" : "Select All"}
          </button>
          <span className="text-[14px] font-medium tabular-nums text-slate-500">
            {selectedIndices.size} of {result.nodes.length} selected
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          disabled={selectedIndices.size === 0}
          className={`flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[15px] font-semibold transition-all ${
            selectedIndices.size > 0
              ? "bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_45%,#0369a1_100%)] text-white shadow-[0_14px_26px_-18px_rgba(2,132,199,0.75),inset_0_1px_0_rgba(255,255,255,0.18)] hover:brightness-110"
              : "cursor-not-allowed bg-slate-100 text-slate-400"
          }`}
        >
          {copied ? (
            <>
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy to Clipboard
            </>
          )}
        </button>
      </div>
    </div>
  );
};
