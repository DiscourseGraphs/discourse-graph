import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { ChevronDown } from "lucide-react";

const NODE_TYPES = [
  {
    label: "Claim",
    description:
      "An assertion about how something works or should work. Usually a single declarative sentence.",
    candidateTag: "#clm-candidate",
    color: "#7DA13E",
  },
  {
    label: "Question",
    description:
      "An unknown being explored through research. Framed as a question that can be investigated.",
    candidateTag: "#que-candidate",
    color: "#99890E",
  },
  {
    label: "Hypothesis",
    description:
      "A proposed answer to a question. Collects evidence for or against.",
    candidateTag: "#hyp-candidate",
    color: "#7C4DFF",
  },
  {
    label: "Evidence",
    description:
      "A discrete observation from a published dataset or experiment. Usually in past tense with observable, model system, and method.",
    candidateTag: "#evd-candidate",
    color: "#dc0c4a",
  },
  {
    label: "Result",
    description:
      "A discrete observation from ongoing research, in past tense. Includes source context.",
    candidateTag: "#res-candidate",
    color: "#E6A23C",
  },
  {
    label: "Source",
    description: "A referenced publication or external resource.",
    candidateTag: "#src-candidate",
    color: "#9E9E9E",
  },
  {
    label: "Theory",
    description: "A theoretical framework or model that explains phenomena.",
    candidateTag: "#the-candidate",
    color: "#8B5CF6",
  },
];

const SECTION_LABEL_CLASS =
  "mb-3 block px-1 text-[18px] font-semibold tracking-[-0.016em] text-slate-800";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Sidebar = () => {
  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-[24px] border border-slate-200/85 bg-white shadow-[0_26px_52px_-38px_rgba(15,23,42,0.6)] lg:w-[390px] xl:w-[420px]">
      <div className="flex-1 overflow-y-auto p-4 lg:p-5">
        <section className="mb-6">
          <h3 className={SECTION_LABEL_CLASS}>Paper</h3>
          <div className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-rose-500 to-rose-600">
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
          <h3 className={SECTION_LABEL_CLASS}>Model</h3>
          <Button
            variant="outline"
            className="w-full justify-between rounded-xl border-slate-300 px-3.5 py-3 text-[16px] font-medium text-slate-700"
          >
            <span>Claude Sonnet 4.6</span>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </Button>
        </section>

        <section className="mb-5">
          <h3 className={SECTION_LABEL_CLASS}>Research Question</h3>
          <div className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-[16px] text-slate-700">
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
              {NODE_TYPES.length}/{NODE_TYPES.length}
            </span>
          </div>

          <div className="space-y-1.5">
            {NODE_TYPES.map((type) => (
              <label
                key={type.candidateTag}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-slate-800 shadow-sm"
              >
                <Checkbox checked />
                <div className="min-w-0 flex-1">
                  <span className="text-[16px] font-medium">{type.label}</span>
                  <p className="truncate text-[12px] text-slate-400">
                    {type.description}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-slate-400">
                  {type.candidateTag}
                </span>
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="border-t border-slate-200/90 bg-white/95 p-4 backdrop-blur-xl">
        <p className="mb-2 text-[14px] font-medium text-slate-500">
          Ready to run extraction.
        </p>
        <Button className="w-full rounded-xl bg-slate-900 py-6 text-[17px] font-semibold text-white hover:bg-slate-800">
          Re-Extract
        </Button>
      </div>
    </aside>
  );
};
