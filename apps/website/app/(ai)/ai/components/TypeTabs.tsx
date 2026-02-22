"use client";

import {
  NODE_TYPES,
  NODE_TYPE_COLORS,
  NODE_TYPE_LABELS,
} from "~/types/extraction";
import type { ExtractionResult, NodeType } from "~/types/extraction";

type TypeTabsProps = {
  result: ExtractionResult;
  activeTab: "all" | NodeType;
  onTabChange: (tab: "all" | NodeType) => void;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const TypeTabs = ({ result, activeTab, onTabChange }: TypeTabsProps) => {
  const typeCounts = new Map<NodeType, number>();
  for (const node of result.nodes) {
    typeCounts.set(node.type, (typeCounts.get(node.type) ?? 0) + 1);
  }

  const visibleTypes = NODE_TYPES.filter((type) => typeCounts.has(type));

  return (
    <div className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-3.5 lg:px-5">
      <div className="flex min-w-max items-center gap-2 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => onTabChange("all")}
          className={`inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-[14px] font-semibold transition-all ${
            activeTab === "all"
              ? "border-transparent bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_45%,#0369a1_100%)] text-white shadow-[0_12px_22px_-16px_rgba(2,132,199,0.8)]"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          All
          <span
            className={`ml-2 text-[13px] tabular-nums ${activeTab === "all" ? "text-slate-200" : "text-slate-400"}`}
          >
            {result.nodes.length}
          </span>
        </button>

        {visibleTypes.map((type) => {
          const count = typeCounts.get(type) ?? 0;
          const isActive = activeTab === type;
          const color = NODE_TYPE_COLORS[type];

          return (
            <button
              type="button"
              key={type}
              onClick={() => onTabChange(type)}
              className={`inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-[14px] font-semibold transition-all ${
                isActive
                  ? "border-slate-300 bg-white text-slate-900 shadow-[0_12px_22px_-18px_rgba(15,23,42,0.55)]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span
                className="mr-2 inline-block h-[8px] w-[8px] rounded-full"
                style={{
                  backgroundColor: color,
                  boxShadow: `0 0 0 3px ${color}20`,
                }}
              />
              {NODE_TYPE_LABELS[type]}
              <span
                className={`ml-2 text-[13px] tabular-nums ${isActive ? "text-slate-500" : "text-slate-400"}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
