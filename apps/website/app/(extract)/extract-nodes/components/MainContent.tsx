import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Copy } from "lucide-react";

const SAMPLE_NODES = [
  {
    label: "Claim",
    candidateTag: "#clm-candidate",
    confidence: 95,
    page: "p.9",
    content:
      "Basolateral secretion of Wnt5a is essential for establishing apical-basal polarity in epithelial cells.",
  },
  {
    label: "Evidence",
    candidateTag: "#evd-candidate",
    confidence: 97,
    page: "p.3",
    content:
      "Wnt5a was detected exclusively in the basolateral medium of polarized MDCK cells grown on Transwell filters, with no detectable signal in the apical fraction.",
  },
  {
    label: "Claim",
    candidateTag: "#clm-candidate",
    confidence: 92,
    page: "p.5",
    content:
      "Loss of Wnt5a function disrupts lumen formation in 3D cyst cultures derived from epithelial cells.",
  },
  {
    label: "Evidence",
    candidateTag: "#evd-candidate",
    confidence: 96,
    page: "p.7",
    content:
      "shRNA-mediated knockdown of Wnt5a resulted in multi-lumen cysts in 68% of colonies compared to 12% in control conditions.",
  },
  {
    label: "Claim",
    candidateTag: "#clm-candidate",
    confidence: 90,
    page: "p.11",
    content:
      "Wnt5a signals through the non-canonical planar cell polarity pathway to regulate lumen morphogenesis.",
  },
  {
    label: "Evidence",
    candidateTag: "#evd-candidate",
    confidence: 94,
    page: "p.8",
    content:
      "Co-immunoprecipitation showed that Wnt5a preferentially binds Ror2 receptor at the basolateral surface.",
  },
] as const;

const TABS = [
  { id: "all", label: "All", count: 6 },
  { id: "clm", label: "Claim", count: 3 },
  { id: "evd", label: "Evidence", count: 3 },
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
              <Badge
                key={tab.id}
                variant={tab.id === "all" ? "default" : "secondary"}
                className="cursor-pointer px-3 py-1.5 text-[14px] font-semibold"
              >
                {tab.label} {tab.count}
              </Badge>
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
                  <Checkbox checked className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="outline" className="text-[11px]">
                        {node.label}
                      </Badge>
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
            <Button variant="outline" size="sm" className="rounded-full">
              Deselect All
            </Button>
            <span className="text-[14px] font-medium tabular-nums text-slate-500">
              6 of 6 selected
            </span>
          </div>

          <Button className="gap-2 rounded-full">
            <Copy className="h-4 w-4" />
            Copy to Clipboard
          </Button>
        </div>
      </div>
    </section>
  );
};
