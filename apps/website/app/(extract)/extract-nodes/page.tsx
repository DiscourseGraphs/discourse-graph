"use client";

import { useCallback, useState } from "react";
import {
  DEFAULT_MODEL_ID,
  NODE_TYPE_DEFINITIONS,
  type ExtractedNode,
} from "~/types/extraction";
import { buildSystemPrompt } from "~/prompts/extraction";
import { MainContent } from "./components/MainContent";
import { Sidebar } from "./components/Sidebar";

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

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
    nodeType: "Claim",
    content:
      "Ror2 receptor activation at the basolateral surface mediates Wnt5a-dependent lumen positioning.",
    supportSnippet:
      '"We hypothesize that Ror2, as the primary receptor for Wnt5a at the basolateral membrane, transduces the polarity signal required for single-lumen formation"',
    sourceSection: "Discussion",
  },
  {
    nodeType: "Evidence",
    content:
      "shRNA-mediated knockdown of Wnt5a resulted in multi-lumen cysts in 68% of colonies compared to 12% in control conditions.",
    supportSnippet:
      '"Quantification of cyst morphology revealed 68 ± 4% multi-lumen cysts in Wnt5a-KD versus 12 ± 3% in controls (Fig. 4B, p < 0.001)"',
    sourceSection: "Results",
  },
  {
    nodeType: "Artifact",
    content:
      "MDCK 3D cyst culture model grown on Matrigel, used to visualize lumen formation by confocal live imaging of F-actin and podocalyxin markers.",
    supportSnippet:
      '"We used MDCK II cells seeded in 100% Matrigel and imaged cyst development over 96 hours using spinning-disk confocal microscopy (Materials and Methods)"',
    sourceSection: "Methods",
  },
  {
    nodeType: "Pattern",
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
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [researchQuestion, setResearchQuestion] = useState("");
  const [selectedTypes, setSelectedTypes] = useState(
    () => new Set(["#evd-candidate", "#clm-candidate"]),
  );
  const [model, setModel] = useState(DEFAULT_MODEL_ID);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [nodes] = useState<ExtractedNode[]>(SAMPLE_NODES);

  const toggleType = useCallback((candidateTag: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(candidateTag)) {
        next.delete(candidateTag);
      } else {
        next.add(candidateTag);
      }
      return next;
    });
  }, []);

  const canExtract = !!pdfFile && selectedTypes.size > 0 && !isExtracting;

  const handleExtract = useCallback(async () => {
    if (!pdfFile) return;
    setIsExtracting(true);
    setExtractionError(null);
    try {
      const pdfBase64 = await readFileAsBase64(pdfFile);
      const nodeTypes = NODE_TYPE_DEFINITIONS.filter((t) =>
        selectedTypes.has(t.candidateTag),
      );
      const systemPrompt = buildSystemPrompt({
        nodeTypes,
        researchQuestion: researchQuestion || undefined,
      });
      const requestBody = {
        pdfBase64,
        provider: "anthropic",
        model,
        systemPrompt,
      };
      const response = await fetch("/api/ai/extract", {
        method: "POST",
        // eslint-disable-next-line @typescript-eslint/naming-convention
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
    } catch (error) {
      console.error("extraction failed:", error);
      setExtractionError(
        "We couldn't extract nodes from this PDF. Please try again.",
      );
    } finally {
      setIsExtracting(false);
    }
  }, [pdfFile, researchQuestion, selectedTypes, model]);

  return (
    <div className="flex h-full w-full flex-1 flex-col gap-4 p-4 lg:flex-row lg:gap-5 lg:p-5">
      <Sidebar
        pdfFile={pdfFile}
        onFileSelect={setPdfFile}
        researchQuestion={researchQuestion}
        onResearchQuestionChange={setResearchQuestion}
        selectedTypes={selectedTypes}
        onToggleType={toggleType}
        model={model}
        onModelChange={setModel}
        onExtract={() => void handleExtract()}
        canExtract={canExtract}
        isExtracting={isExtracting}
        extractionError={extractionError}
      />
      <MainContent nodes={nodes} />
    </div>
  );
};

export default ExtractNodesPage;
