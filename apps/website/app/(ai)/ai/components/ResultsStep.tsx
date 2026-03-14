"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@repo/ui/components/ui/button";
import type { ExtractionResult, NodeType } from "~/types/extraction";
import { NODE_TYPES, NODE_TYPE_LABELS } from "~/types/extraction";
import { formatNodesForClipboard } from "~/utils/ai/formatClipboard";
import { NodeCard } from "./NodeCard";

type ResultsStepProps = {
  result: ExtractionResult;
  onStartOver: () => void;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ResultsStep = ({ result, onStartOver }: ResultsStepProps) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    () => new Set(result.nodes.keys()),
  );
  const [copied, setCopied] = useState(false);

  const allSelected = selectedIndices.size === result.nodes.length;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(result.nodes.keys()));
    }
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
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const selected = result.nodes.filter((_n, i) => selectedIndices.has(i));
    const text = formatNodesForClipboard(selected);
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result.nodes, selectedIndices]);

  // Group nodes by type for display
  const groupedNodes = useMemo(() => {
    const groups: { type: NodeType; nodes: { node: (typeof result.nodes)[0]; index: number }[] }[] = [];
    for (const type of NODE_TYPES) {
      const matching = result.nodes
        .map((node, index) => ({ node, index }))
        .filter(({ node }) => node.type === type);
      if (matching.length > 0) {
        groups.push({ type, nodes: matching });
      }
    }
    return groups;
  }, [result]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      {/* Paper info */}
      {(result.paperTitle || result.paperAuthors?.length) && (
        <div className="rounded-lg border bg-white p-4">
          {result.paperTitle && (
            <h2 className="font-semibold text-neutral-dark">
              {result.paperTitle}
            </h2>
          )}
          {result.paperAuthors?.length ? (
            <p className="text-sm text-gray-600">
              {result.paperAuthors.join(", ")}
            </p>
          ) : null}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={toggleAll}>
            {allSelected ? "Deselect All" : "Select All"}
          </Button>
          <span className="text-sm text-gray-500">
            {selectedIndices.size} of {result.nodes.length} nodes selected
          </span>
        </div>
      </div>

      {/* Grouped nodes */}
      <div className="space-y-6">
        {groupedNodes.map(({ type, nodes }) => (
          <div key={type} className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              {NODE_TYPE_LABELS[type]}s ({nodes.length})
            </h3>
            <div className="space-y-2">
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

      {/* Footer */}
      <div className="sticky bottom-0 flex items-center justify-between rounded-lg border bg-white p-4 shadow-md">
        <Button variant="outline" onClick={onStartOver}>
          Start Over
        </Button>
        <Button
          onClick={handleCopy}
          disabled={selectedIndices.size === 0}
        >
          {copied ? "Copied!" : `Copy ${selectedIndices.size} Nodes to Clipboard`}
        </Button>
      </div>
    </div>
  );
};
