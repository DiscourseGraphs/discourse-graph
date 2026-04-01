const SAMPLE_NODES = [
  {
    type: "CLM" as const,
    label: "CLAIM",
    color: "#7DA13E",
    confidence: 95,
    page: "p.9",
    content:
      "Basolateral secretion of Wnt5a is essential for establishing apical-basal polarity in epithelial cells.",
  },
  {
    type: "EVD" as const,
    label: "EVIDENCE",
    color: "#DB134A",
    confidence: 97,
    page: "p.3",
    content:
      "Wnt5a was detected exclusively in the basolateral medium of polarized MDCK cells grown on Transwell filters, with no detectable signal in the apical fraction.",
  },
  {
    type: "CLM" as const,
    label: "CLAIM",
    color: "#7DA13E",
    confidence: 92,
    page: "p.5",
    content:
      "Loss of Wnt5a function disrupts lumen formation in 3D cyst cultures derived from epithelial cells.",
  },
  {
    type: "EVD" as const,
    label: "EVIDENCE",
    color: "#DB134A",
    confidence: 96,
    page: "p.7",
    content:
      "shRNA-mediated knockdown of Wnt5a resulted in multi-lumen cysts in 68% of colonies compared to 12% in control conditions.",
  },
  {
    type: "CLM" as const,
    label: "CLAIM",
    color: "#7DA13E",
    confidence: 90,
    page: "p.11",
    content:
      "Wnt5a signals through the non-canonical planar cell polarity pathway to regulate lumen morphogenesis.",
  },
  {
    type: "EVD" as const,
    label: "EVIDENCE",
    color: "#DB134A",
    confidence: 94,
    page: "p.8",
    content:
      "Co-immunoprecipitation showed that Wnt5a preferentially binds Ror2 receptor at the basolateral surface.",
  },
] as const;

const TABS = [
  { id: "all" as const, label: "All", count: 17, color: undefined },
  { id: "CLM" as const, label: "Claim", count: 6, color: "#7DA13E" },
  { id: "EVD" as const, label: "Evidence", count: 11, color: "#DB134A" },
];

// eslint-disable-next-line @typescript-eslint/naming-convention
export const MainContent = () => {
  return (
    <section className="flex min-h-[420px] flex-1 overflow-hidden rounded-[24px] border border-slate-200/85 bg-white shadow-[0_24px_48px_-36px_rgba(15,23,42,0.55)]">
      <div className="flex flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
        <div className="relative shrink-0 border-b border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] px-4 py-4 lg:px-5">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,#0ea5e9_0%,#22d3ee_45%,#34d399_100%)]" />
          <h2 className="text-[24px] font-semibold tracking-[-0.024em] text-slate-900">
            Basolateral secretion of Wnt5a in polarized epithelial cells is
            required for apical lumen formation
          </h2>
          <p className="mt-1 text-[15px] text-slate-500">
            Yamamoto H, Komekado H, Kikuchi A
          </p>
        </div>

        <div className="shrink-0 border-b border-slate-200/70 bg-white/95 px-4 lg:px-5">
          <div className="flex gap-1 py-2">
            {TABS.map((tab) => (
              <div
                key={tab.id}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-semibold transition-colors ${
                  tab.id === "all"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600"
                }`}
              >
                {tab.color && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: tab.color }}
                  />
                )}
                <span>
                  {tab.label} {tab.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[radial-gradient(120%_100%_at_50%_0%,#f8fbff_0%,#f8fafc_52%,#f3f7fb_100%)] p-4 lg:p-5">
          <div className="space-y-2.5">
            {SAMPLE_NODES.map((node, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200/85 bg-white p-4 shadow-[0_8px_20px_-16px_rgba(15,23,42,0.45)]"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px]"
                    style={{
                      backgroundColor: node.color,
                      boxShadow: `0 1px 2px ${node.color}40, inset 0 1px 0 rgba(255,255,255,0.15)`,
                    }}
                  >
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
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white"
                        style={{ backgroundColor: node.color }}
                      >
                        {node.label}
                      </span>
                      <span className="text-[13px] font-semibold tabular-nums text-slate-500">
                        {node.confidence}%
                      </span>
                      <span className="text-[13px] text-slate-400">
                        {node.page}
                      </span>
                    </div>
                    <p className="text-[15px] leading-relaxed text-slate-800">
                      {node.content}
                    </p>
                    <button
                      type="button"
                      className="mt-2 text-[13px] font-medium text-slate-400"
                    >
                      Show details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200/85 bg-white/95 px-4 py-3.5 backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:px-5">
          <div className="flex items-center gap-2.5">
            <span className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[14px] font-semibold text-slate-600">
              Deselect All
            </span>
            <span className="text-[14px] font-medium tabular-nums text-slate-500">
              17 of 17 selected
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_45%,#0369a1_100%)] px-4 py-2.5 text-[15px] font-semibold text-white shadow-[0_14px_26px_-18px_rgba(2,132,199,0.75),inset_0_1px_0_rgba(255,255,255,0.18)]">
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
          </div>
        </div>
      </div>
    </section>
  );
};
