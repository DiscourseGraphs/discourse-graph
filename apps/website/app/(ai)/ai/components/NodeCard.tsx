"use client";

import { useState } from "react";
import { NODE_TYPE_COLORS, NODE_TYPE_LABELS } from "~/types/extraction";
import type { ExtractedNode } from "~/types/extraction";

type NodeCardProps = {
  node: ExtractedNode;
  selected: boolean;
  onToggle: () => void;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const NodeCard = ({ node, selected, onToggle }: NodeCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const color = NODE_TYPE_COLORS[node.type];

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border transition-all ${
        selected
          ? "border-slate-300 bg-white shadow-[0_22px_34px_-30px_rgba(15,23,42,0.7)]"
          : "border-slate-200/80 bg-white/90 hover:border-slate-300 hover:bg-white hover:shadow-[0_16px_30px_-28px_rgba(15,23,42,0.65)]"
      }`}
    >
      <span
        className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full transition-opacity"
        style={{ backgroundColor: color, opacity: selected ? 0.95 : 0.45 }}
      />

      <div className="flex items-start gap-3.5 px-4 py-3.5 lg:px-5">
        <button
          type="button"
          onClick={onToggle}
          className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] transition-all"
          style={{
            backgroundColor: selected ? color : "transparent",
            boxShadow: selected
              ? `0 1px 2px ${color}40, inset 0 1px 0 rgba(255,255,255,0.15)`
              : "inset 0 0 0 1.7px #cbd5e1",
          }}
        >
          {selected && (
            <svg
              className="h-[10px] w-[10px] text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex rounded-md px-2 py-0.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-white"
              style={{ backgroundColor: color }}
            >
              {NODE_TYPE_LABELS[node.type]}
            </span>

            {node.confidence !== undefined && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[13px] font-medium tabular-nums text-slate-500">
                {Math.round(node.confidence * 100)}%
              </span>
            )}

            {node.pageNumber !== undefined && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[13px] font-medium text-slate-500">
                p.{node.pageNumber}
              </span>
            )}
          </div>

          <p className="text-[16px] leading-[1.6] tracking-[-0.006em] text-slate-700">
            {node.content}
          </p>

          {(node.sourceQuote || node.section || node.reasoning) && (
            <>
              <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-slate-500 transition-colors hover:text-slate-700"
              >
                <svg
                  className={`h-3.5 w-3.5 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                {expanded ? "Hide details" : "Show details"}
              </button>

              {expanded && (
                <div
                  className="mt-2.5 space-y-2 rounded-xl border px-3 py-2.5"
                  style={{
                    borderColor: `${color}2E`,
                    backgroundColor: `${color}12`,
                  }}
                >
                  {node.sourceQuote && (
                    <p className="text-[14px] italic leading-[1.55] text-slate-700">
                      &ldquo;{node.sourceQuote}&rdquo;
                    </p>
                  )}

                  {node.section && (
                    <p className="text-[14px] text-slate-700">
                      <span className="font-semibold text-slate-800">
                        Section:
                      </span>{" "}
                      {node.section}
                    </p>
                  )}

                  {node.reasoning && (
                    <p className="text-[14px] leading-[1.55] text-slate-700">
                      {node.reasoning}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
