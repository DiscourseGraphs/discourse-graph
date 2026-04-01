const NODE_TYPES = [
  { id: "CLM", label: "Claim", color: "#7DA13E" },
  { id: "QUE", label: "Question", color: "#99890E" },
  { id: "EVD", label: "Evidence", color: "#DB134A" },
  { id: "SRC", label: "Source", color: "#9E9E9E" },
  { id: "ISS", label: "Issue", color: "#F56C6C" },
  { id: "RES", label: "Result", color: "#E6A23C" },
  { id: "EXP", label: "Experiment", color: "#4A90D9" },
  { id: "THR", label: "Theory", color: "#8B5CF6" },
  { id: "ART", label: "Artifact", color: "#67C23A" },
] as const;

const CHECKED_TYPES = new Set(["CLM", "EVD"]);

const sectionLabelClass =
  "mb-3 block px-1 text-[18px] font-semibold tracking-[-0.016em] text-slate-800";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Sidebar = () => {
  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-[24px] border border-slate-200/85 bg-white shadow-[0_26px_52px_-38px_rgba(15,23,42,0.6)] lg:w-[390px] xl:w-[420px]">
      <div className="flex-1 overflow-y-auto p-4 lg:p-5">
        <section className="mb-6">
          <h3 className={sectionLabelClass}>Paper</h3>
          <div className="group relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3.5 text-left">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-rose-500 to-rose-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
              <span className="text-[11px] font-bold tracking-[0.02em] text-white">
                PDF
              </span>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="truncate text-[16px] font-semibold leading-tight text-slate-900">
                Yamamoto et al. - 2015 - Basolate...
              </p>
              <p className="mt-1 text-[14px] leading-tight text-slate-500">
                7.8 MB &middot;{" "}
                <span className="font-medium text-slate-500">Replace file</span>
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h3 className={sectionLabelClass}>Model</h3>
          <div className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white py-3 pl-3.5 pr-3.5 text-left text-[16px] font-medium text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <span>Claude Sonnet 4.6</span>
            <svg
              className="h-4 w-4 shrink-0 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </section>

        <section className="mb-5">
          <h3 className={sectionLabelClass}>Research Question</h3>
          <div className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-[16px] text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            What are the molecular determinants of lumenoid formation in hiPSCs?
          </div>
        </section>

        <div className="mx-1 mb-5 border-t border-slate-200" />

        <section>
          <div className="mb-2.5 flex items-center justify-between px-1">
            <h3 className="text-[18px] font-semibold tracking-[-0.016em] text-slate-800">
              Node Types
            </h3>
            <span className="text-[13px] font-semibold tabular-nums text-slate-500">
              {CHECKED_TYPES.size}/{NODE_TYPES.length}
            </span>
          </div>

          <div className="space-y-1.5">
            {NODE_TYPES.map((type) => {
              const isChecked = CHECKED_TYPES.has(type.id);
              return (
                <div
                  key={type.id}
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left ${
                    isChecked
                      ? "border-slate-200 bg-white text-slate-800 shadow-[0_10px_22px_-24px_rgba(15,23,42,0.55)]"
                      : "border-transparent text-slate-500"
                  }`}
                >
                  <div
                    className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px]"
                    style={{
                      backgroundColor: isChecked ? type.color : "transparent",
                      boxShadow: isChecked
                        ? `0 1px 2px ${type.color}40, inset 0 1px 0 rgba(255,255,255,0.15)`
                        : "inset 0 0 0 1.8px #cbd5e1",
                    }}
                  >
                    {isChecked && (
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
                  </div>
                  <span className="text-[16px] font-medium">{type.label}</span>
                  <span className="ml-auto text-[12px] font-semibold text-slate-400">
                    {type.id}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="relative z-50 border-t border-slate-200/90 bg-white/95 p-4 backdrop-blur-xl">
        <p className="mb-2 text-[14px] font-medium text-slate-500">
          Ready to run extraction.
        </p>
        <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 px-4 py-3.5 text-[17px] font-semibold text-white shadow-[0_14px_24px_-18px_rgba(15,23,42,0.85),inset_0_1px_0_rgba(255,255,255,0.12)]">
          Re-Extract
        </div>
      </div>
    </aside>
  );
};
