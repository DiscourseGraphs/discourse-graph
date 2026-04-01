import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Copy } from "lucide-react";

const NODE_TYPE_COLORS: Record<string, string> = {
  claim: "#7DA13E",
  question: "#99890E",
  hypothesis: "#7C4DFF",
  evidence: "#dc0c4a",
  result: "#E6A23C",
  source: "#9E9E9E",
  theory: "#8B5CF6",
};

const SAMPLE_NODES = [
  {
    nodeType: "claim",
    content:
      "Basolateral secretion of Wnt5a is essential for establishing apical-basal polarity in epithelial cells.",
    supportSnippet:
      '"Wnt5a secreted from the basolateral surface was both necessary and sufficient for the establishment of apical-basal polarity" (p.9)',
    sourceSection: "Discussion",
  },
  {
    nodeType: "evidence",
    content:
      "Wnt5a was detected exclusively in the basolateral medium of polarized MDCK cells grown on Transwell filters, with no detectable signal in the apical fraction.",
    supportSnippet:
      '"Western blot analysis of conditioned media showed Wnt5a protein exclusively in the basolateral fraction (Fig. 2A, lanes 3-4)"',
    sourceSection: "Results",
  },
  {
    nodeType: "question",
    content:
      "What is the mechanism by which Wnt5a polarized secretion is directed to the basolateral membrane?",
    supportSnippet:
      '"The mechanism that directs Wnt5a specifically to the basolateral surface remains an open question" (p.11)',
    sourceSection: "Discussion",
  },
  {
    nodeType: "hypothesis",
    content:
      "Ror2 receptor activation at the basolateral surface mediates Wnt5a-dependent lumen positioning.",
    supportSnippet:
      '"We hypothesize that Ror2, as the primary receptor for Wnt5a at the basolateral membrane, transduces the polarity signal required for single-lumen formation"',
    sourceSection: "Discussion",
  },
  {
    nodeType: "result",
    content:
      "shRNA-mediated knockdown of Wnt5a resulted in multi-lumen cysts in 68% of colonies compared to 12% in control conditions.",
    supportSnippet:
      '"Quantification of cyst morphology revealed 68 ± 4% multi-lumen cysts in Wnt5a-KD versus 12 ± 3% in controls (Fig. 4B, p < 0.001)"',
    sourceSection: "Results",
  },
  {
    nodeType: "source",
    content: "Yamamoto et al. (2015) Nature Cell Biology 17(8):1024-1035",
    supportSnippet:
      "Primary research article on Wnt5a basolateral secretion and lumen formation in polarized epithelia.",
    sourceSection: "References",
  },
  {
    nodeType: "theory",
    content:
      "Non-canonical Wnt signaling through the planar cell polarity pathway is a conserved mechanism for epithelial lumen morphogenesis.",
    supportSnippet:
      '"Our findings place Wnt5a upstream of the PCP pathway in the regulation of epithelial lumen morphogenesis, consistent with the broader role of non-canonical Wnt signaling in tissue polarity"',
    sourceSection: "Discussion",
  },
  {
    nodeType: "evidence",
    content:
      "Co-immunoprecipitation showed that Wnt5a preferentially binds Ror2 receptor at the basolateral surface.",
    supportSnippet:
      '"IP-Western analysis demonstrated direct Wnt5a-Ror2 interaction in basolateral but not apical membrane fractions (Fig. 5C)"',
    sourceSection: "Results",
  },
  {
    nodeType: "claim",
    content:
      "Loss of Wnt5a function disrupts lumen formation in 3D cyst cultures derived from epithelial cells.",
    supportSnippet:
      '"These data demonstrate that Wnt5a is required for proper lumen formation in three-dimensional culture systems"',
    sourceSection: "Discussion",
  },
];

const EXPANDED_INDICES = new Set([0, 1]);

const typeCounts = SAMPLE_NODES.reduce<Record<string, number>>((acc, node) => {
  acc[node.nodeType] = (acc[node.nodeType] ?? 0) + 1;
  return acc;
}, {});

const TABS = [
  { id: "all", label: "All", count: SAMPLE_NODES.length, color: undefined },
  ...Object.entries(typeCounts).map(([nodeType, count]) => ({
    id: nodeType,
    label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
    count,
    color: NODE_TYPE_COLORS[nodeType],
  })),
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
                variant={tab.id === "all" ? "default" : "outline"}
                className={
                  tab.id === "all"
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
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[radial-gradient(120%_100%_at_50%_0%,#f8fbff_0%,#f8fafc_52%,#f3f7fb_100%)] p-4 lg:p-5">
          <div className="space-y-2.5">
            {SAMPLE_NODES.map((node, index) => {
              const color = NODE_TYPE_COLORS[node.nodeType] ?? "#64748b";
              const isExpanded = EXPANDED_INDICES.has(index);
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
                            >
                              Hide details
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 h-auto p-0 text-[13px] font-medium text-slate-400 hover:text-slate-600"
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
              {SAMPLE_NODES.length} of {SAMPLE_NODES.length} selected
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
