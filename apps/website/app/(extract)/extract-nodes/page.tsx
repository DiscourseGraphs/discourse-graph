"use client";

import { useState } from "react";
import type { ExtractedNode } from "~/types/extraction";
import { MainContent } from "./components/MainContent";
import { Sidebar } from "./components/Sidebar";

// TODO(ENG-1592): Replace with actual extraction results from API
const SAMPLE_NODES: ExtractedNode[] = [
  {
    nodeType: "Claim",
    content:
      "Basolateral secretion of Wnt5a is essential for establishing apical-basal polarity in epithelial cells.",
    supportSnippet:
      '"Wnt5a secreted from the basolateral surface was both necessary and sufficient for the establishment of apical-basal polarity" (p.9)',
    sourceSection: "Discussion",
  },
  {
    nodeType: "Evidence",
    content:
      "Wnt5a was detected exclusively in the basolateral medium of polarized MDCK cells grown on Transwell filters, with no detectable signal in the apical fraction.",
    supportSnippet:
      '"Western blot analysis of conditioned media showed Wnt5a protein exclusively in the basolateral fraction (Fig. 2A, lanes 3-4)"',
    sourceSection: "Results",
  },
  {
    nodeType: "Question",
    content:
      "What is the mechanism by which Wnt5a polarized secretion is directed to the basolateral membrane?",
    supportSnippet:
      '"The mechanism that directs Wnt5a specifically to the basolateral surface remains an open question" (p.11)',
    sourceSection: "Discussion",
  },
  {
    nodeType: "Hypothesis",
    content:
      "Ror2 receptor activation at the basolateral surface mediates Wnt5a-dependent lumen positioning.",
    supportSnippet:
      '"We hypothesize that Ror2, as the primary receptor for Wnt5a at the basolateral membrane, transduces the polarity signal required for single-lumen formation"',
    sourceSection: "Discussion",
  },
  {
    nodeType: "Result",
    content:
      "shRNA-mediated knockdown of Wnt5a resulted in multi-lumen cysts in 68% of colonies compared to 12% in control conditions.",
    supportSnippet:
      '"Quantification of cyst morphology revealed 68 ± 4% multi-lumen cysts in Wnt5a-KD versus 12 ± 3% in controls (Fig. 4B, p < 0.001)"',
    sourceSection: "Results",
  },
  {
    nodeType: "Source",
    content: "Yamamoto et al. (2015) Nature Cell Biology 17(8):1024-1035",
    supportSnippet:
      "Primary research article on Wnt5a basolateral secretion and lumen formation in polarized epithelia.",
    sourceSection: "References",
  },
  {
    nodeType: "Theory",
    content:
      "Non-canonical Wnt signaling through the planar cell polarity pathway is a conserved mechanism for epithelial lumen morphogenesis.",
    supportSnippet:
      '"Our findings place Wnt5a upstream of the PCP pathway in the regulation of epithelial lumen morphogenesis, consistent with the broader role of non-canonical Wnt signaling in tissue polarity"',
    sourceSection: "Discussion",
  },
  {
    nodeType: "Evidence",
    content:
      "Co-immunoprecipitation showed that Wnt5a preferentially binds Ror2 receptor at the basolateral surface.",
    supportSnippet:
      '"IP-Western analysis demonstrated direct Wnt5a-Ror2 interaction in basolateral but not apical membrane fractions (Fig. 5C)"',
    sourceSection: "Results",
  },
  {
    nodeType: "Claim",
    content:
      "Loss of Wnt5a function disrupts lumen formation in 3D cyst cultures derived from epithelial cells.",
    supportSnippet:
      '"These data demonstrate that Wnt5a is required for proper lumen formation in three-dimensional culture systems"',
    sourceSection: "Discussion",
  },
];

const ExtractNodesPage = (): React.ReactElement => {
  // TODO(ENG-1592): Wire to actual extraction API results
  const [nodes] = useState<ExtractedNode[]>(SAMPLE_NODES);

  return (
    <div className="flex h-full w-full flex-1 flex-col gap-4 p-4 lg:flex-row lg:gap-5 lg:p-5">
      <Sidebar />
      <MainContent nodes={nodes} />
    </div>
  );
};

export default ExtractNodesPage;
