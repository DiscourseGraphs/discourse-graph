"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Copy, Loader2 } from "lucide-react";
import {
  NODE_TYPE_DEFINITIONS,
  type ExtractedNode,
  type NodeTypeDefinition,
} from "~/types/extraction";

const findNodeTypeDefinition = (
  nodeType: string,
): NodeTypeDefinition | undefined =>
  NODE_TYPE_DEFINITIONS.find(
    (t) => t.label.toLowerCase() === nodeType.toLowerCase(),
  );

const formatNodeForClipboard = (node: ExtractedNode): string => {
  const meta = findNodeTypeDefinition(node.nodeType);
  const header = meta ? `${node.content} ${meta.candidateTag}` : node.content;
  const lines = [header, `\tSource quote: "${node.supportSnippet}"`];
  if (node.sourceSection) {
    lines.push(`\tSection: ${node.sourceSection}`);
  }
  return lines.join("\n");
};

type MainContentProps = {
  nodes: ExtractedNode[];
  isExtracting: boolean;
  hasExtracted: boolean;
  paperTitle?: string;
};

export const MainContent = ({
  nodes,
  isExtracting,
  hasExtracted,
  paperTitle,
}: MainContentProps): React.ReactElement => {
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [activeFilter, setActiveFilter] = useState("all");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSelected(new Set());
    setExpandedNodes(new Set());
    setActiveFilter("all");
  }, [nodes]);

  const typeCounts = useMemo(
    () =>
      nodes.reduce<Record<string, number>>((acc, node) => {
        const key = node.nodeType.toLowerCase();
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {}),
    [nodes],
  );

  const tabs = useMemo(
    () => [
      { id: "all", label: "All", count: nodes.length, color: undefined },
      ...Object.entries(typeCounts).map(([nodeType, count]) => ({
        id: nodeType,
        label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
        count,
        color: findNodeTypeDefinition(nodeType)?.color,
      })),
    ],
    [nodes.length, typeCounts],
  );

  const filteredNodes = useMemo(() => {
    const indexed = nodes.map((node, originalIndex) => ({
      node,
      originalIndex,
    }));
    return activeFilter === "all"
      ? indexed
      : indexed.filter(
          ({ node }) => node.nodeType.toLowerCase() === activeFilter,
        );
  }, [nodes, activeFilter]);

  const toggleExpanded = (index: number): void => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleSelected = (index: number): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAll = (): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      filteredNodes.forEach((f) => next.add(f.originalIndex));
      return next;
    });
  };

  const visibleSelectedCount = filteredNodes.filter((f) =>
    selected.has(f.originalIndex),
  ).length;
  const hasHiddenSelections = selected.size > visibleSelectedCount;

  const deselectAll = (): void => {
    setSelected(new Set());
  };

  const handleCopy = async (): Promise<void> => {
    const text = [...selected]
      .sort((a, b) => a - b)
      .map((i) => formatNodeForClipboard(nodes[i]!))
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isExtracting && nodes.length === 0) {
    return (
      <section className="flex min-h-96 flex-1 items-center justify-center overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-xl">
        <Loader2
          aria-label="Extracting nodes"
          className="h-10 w-10 animate-spin text-slate-400"
        />
      </section>
    );
  }

  if (nodes.length === 0) {
    const title = hasExtracted
      ? "No extractable nodes found in this PDF"
      : "No extracted nodes yet";
    const subtitle = hasExtracted
      ? "Try a different paper or adjust the selected node types."
      : "Upload a paper and run extraction to see results here.";
    return (
      <section className="flex min-h-96 flex-1 items-center justify-center overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-xl">
        <div className="text-center">
          <p className="text-lg font-medium text-slate-400">{title}</p>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-96 flex-1 overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-xl">
      <div className="flex flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
        {paperTitle && (
          <div className="relative shrink-0 border-b border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] px-4 py-4 lg:px-5">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-[linear-gradient(90deg,#0ea5e9_0%,#22d3ee_45%,#34d399_100%)]" />
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              {paperTitle}
            </h2>
          </div>
        )}

        <div className="shrink-0 border-b border-slate-200/70 bg-white/95 px-4 lg:px-5">
          <div className="flex gap-1 py-2">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setActiveFilter(tab.id)}
                className="h-auto rounded-full p-0 hover:bg-transparent"
              >
                <Badge
                  variant={tab.id === activeFilter ? "default" : "outline"}
                  className={
                    tab.id === activeFilter
                      ? "bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
                      : "px-3 py-1.5 text-sm font-semibold text-slate-600"
                  }
                >
                  {tab.color && (
                    <span
                      className="mr-1.5 inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: tab.color }}
                    />
                  )}
                  {tab.label} {tab.count}
                </Badge>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[radial-gradient(120%_100%_at_50%_0%,#f8fbff_0%,#f8fafc_52%,#f3f7fb_100%)] p-4 lg:p-5">
          <div className="space-y-2.5">
            {filteredNodes.map(({ node, originalIndex }) => {
              const color =
                findNodeTypeDefinition(node.nodeType)?.color ?? "#64748b";
              const isExpanded = expandedNodes.has(originalIndex);
              const isSelected = selected.has(originalIndex);
              return (
                <Card
                  key={originalIndex}
                  className="rounded-2xl border-slate-200/85"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelected(originalIndex)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className="rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white"
                            style={{ backgroundColor: color }}
                          >
                            {node.nodeType}
                          </span>
                          {node.sourceSection && (
                            <span className="text-xs text-slate-400">
                              {node.sourceSection}
                            </span>
                          )}
                        </div>
                        <p className="text-sm leading-relaxed text-slate-800">
                          {node.content}
                        </p>
                        {isExpanded ? (
                          <>
                            <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                              <p className="text-xs italic leading-relaxed text-slate-500">
                                {node.supportSnippet}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1 h-auto p-0 text-xs font-medium text-slate-400 hover:text-slate-600"
                              onClick={() => toggleExpanded(originalIndex)}
                            >
                              Hide details
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 h-auto p-0 text-xs font-medium text-slate-400 hover:text-slate-600"
                            onClick={() => toggleExpanded(originalIndex)}
                          >
                            Show details
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200/85 bg-white/95 px-4 py-3.5 backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:px-5">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center overflow-hidden rounded-full border border-slate-200">
              <Button
                variant="ghost"
                size="sm"
                disabled={visibleSelectedCount === filteredNodes.length}
                onClick={selectAll}
                className="rounded-none text-slate-600"
              >
                Select all
              </Button>
              <div className="h-5 w-px bg-slate-200" />
              <Button
                variant="ghost"
                size="sm"
                disabled={selected.size === 0}
                onClick={deselectAll}
                className="rounded-none text-slate-600"
              >
                Deselect all
              </Button>
            </div>
            <span className="text-sm font-medium tabular-nums text-slate-500">
              {hasHiddenSelections
                ? `${visibleSelectedCount} of ${filteredNodes.length} in view · ${selected.size} selected total`
                : `${visibleSelectedCount} of ${filteredNodes.length} selected`}
            </span>
          </div>

          <Button
            disabled={selected.size === 0}
            onClick={() => {
              void handleCopy();
            }}
            className="gap-2 rounded-full bg-slate-900 text-white hover:bg-slate-800"
          >
            <Copy className="h-4 w-4" />
            {copied ? "Copied!" : "Copy to Clipboard"}
          </Button>
        </div>
      </div>
    </section>
  );
};
