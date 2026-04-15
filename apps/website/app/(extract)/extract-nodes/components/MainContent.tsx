"use client";

import { useState, useMemo } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Copy } from "lucide-react";
import type { ExtractedNode } from "~/types/extraction";

const NODE_TYPE_COLORS: Record<string, string> = {
  claim: "#7DA13E",
  question: "#99890E",
  hypothesis: "#7C4DFF",
  evidence: "#dc0c4a",
  result: "#E6A23C",
  source: "#9E9E9E",
  theory: "#8B5CF6",
};

type MainContentProps = {
  nodes: ExtractedNode[];
  paperTitle?: string;
};

export const MainContent = ({
  nodes,
  paperTitle,
}: MainContentProps): React.ReactElement => {
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [activeFilter, setActiveFilter] = useState("all");

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
        color: NODE_TYPE_COLORS[nodeType],
      })),
    ],
    [nodes.length, typeCounts],
  );

  const filteredNodes = useMemo(
    () =>
      activeFilter === "all"
        ? nodes
        : nodes.filter((node) => node.nodeType.toLowerCase() === activeFilter),
    [nodes, activeFilter],
  );

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

  if (nodes.length === 0) {
    return (
      <section className="flex min-h-[420px] flex-1 items-center justify-center overflow-hidden rounded-[24px] border border-slate-200/85 bg-white shadow-[0_24px_48px_-36px_rgba(15,23,42,0.55)]">
        <div className="text-center">
          <p className="text-[18px] font-medium text-slate-400">
            No extracted nodes yet
          </p>
          <p className="mt-1 text-[15px] text-slate-400">
            Upload a paper and run extraction to see results here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-[420px] flex-1 overflow-hidden rounded-[24px] border border-slate-200/85 bg-white shadow-[0_24px_48px_-36px_rgba(15,23,42,0.55)]">
      <div className="flex flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
        {paperTitle && (
          <div className="relative shrink-0 border-b border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] px-4 py-4 lg:px-5">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,#0ea5e9_0%,#22d3ee_45%,#34d399_100%)]" />
            <h2 className="text-[24px] font-semibold tracking-[-0.024em] text-slate-900">
              {paperTitle}
            </h2>
          </div>
        )}

        <div className="shrink-0 border-b border-slate-200/70 bg-white/95 px-4 lg:px-5">
          <div className="flex gap-1 py-2">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveFilter(tab.id)}>
                <Badge
                  variant={tab.id === activeFilter ? "default" : "outline"}
                  className={
                    tab.id === activeFilter
                      ? "bg-slate-900 px-3 py-1.5 text-[14px] font-semibold text-white hover:bg-slate-800"
                      : "px-3 py-1.5 text-[14px] font-semibold text-slate-600"
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
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[radial-gradient(120%_100%_at_50%_0%,#f8fbff_0%,#f8fafc_52%,#f3f7fb_100%)] p-4 lg:p-5">
          <div className="space-y-2.5">
            {filteredNodes.map((node, index) => {
              const color =
                NODE_TYPE_COLORS[node.nodeType.toLowerCase()] ?? "#64748b";
              const isExpanded = expandedNodes.has(index);
              return (
                <Card key={index} className="rounded-2xl border-slate-200/85">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox checked className="mt-1" />
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className="rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white"
                            style={{ backgroundColor: color }}
                          >
                            {node.nodeType}
                          </span>
                          {node.sourceSection && (
                            <span className="text-[13px] text-slate-400">
                              {node.sourceSection}
                            </span>
                          )}
                        </div>
                        <p className="text-[15px] leading-relaxed text-slate-800">
                          {node.content}
                        </p>
                        {isExpanded ? (
                          <>
                            <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                              <p className="text-[13px] italic leading-relaxed text-slate-500">
                                {node.supportSnippet}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1 h-auto p-0 text-[13px] font-medium text-slate-400 hover:text-slate-600"
                              onClick={() => toggleExpanded(index)}
                            >
                              Hide details
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 h-auto p-0 text-[13px] font-medium text-slate-400 hover:text-slate-600"
                            onClick={() => toggleExpanded(index)}
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
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-slate-200 text-slate-600"
            >
              Deselect All
            </Button>
            <span className="text-[14px] font-medium tabular-nums text-slate-500">
              {nodes.length} of {nodes.length} selected
            </span>
          </div>

          <Button className="gap-2 rounded-full bg-slate-900 text-white hover:bg-slate-800">
            <Copy className="h-4 w-4" />
            Copy to Clipboard
          </Button>
        </div>
      </div>
    </section>
  );
};
