"use client";

import { useCallback, useState } from "react";
import {
  DEFAULT_MODEL_ID,
  ExtractionResultSchema,
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

const GENERIC_EXTRACTION_ERROR =
  "We couldn't extract nodes from this PDF. Please try again.";

const ExtractNodesPage = (): React.ReactElement => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [researchQuestion, setResearchQuestion] = useState("");
  const [selectedTypes, setSelectedTypes] = useState(
    () => new Set(["#evd-candidate", "#clm-candidate"]),
  );
  const [model, setModel] = useState(DEFAULT_MODEL_ID);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<ExtractedNode[]>([]);
  const [hasExtracted, setHasExtracted] = useState(false);

  const handleFileSelect = useCallback((file: File) => {
    setPdfFile(file);
    setExtractionError(null);
  }, []);

  const handleResearchQuestionChange = useCallback((value: string) => {
    setResearchQuestion(value);
    setExtractionError(null);
  }, []);

  const handleToggleType = useCallback((candidateTag: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(candidateTag)) {
        next.delete(candidateTag);
      } else {
        next.add(candidateTag);
      }
      return next;
    });
    setExtractionError(null);
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
      const json: unknown = await response.json();
      if (!response.ok) {
        const serverMessage =
          typeof (json as { error?: unknown })?.error === "string"
            ? (json as { error: string }).error
            : `Request failed with status ${response.status}`;
        throw new Error(serverMessage);
      }
      const parsed = ExtractionResultSchema.safeParse(json);
      if (!parsed.success) {
        throw new Error("Server returned unexpected response shape");
      }
      setNodes(parsed.data.nodes);
      setHasExtracted(true);
    } catch (error) {
      console.error("extraction failed:", error);
      setExtractionError(GENERIC_EXTRACTION_ERROR);
    } finally {
      setIsExtracting(false);
    }
  }, [pdfFile, researchQuestion, selectedTypes, model]);

  return (
    <div className="flex h-full w-full flex-1 flex-col gap-4 p-4 lg:flex-row lg:gap-5 lg:p-5">
      <Sidebar
        pdfFile={pdfFile}
        onFileSelect={handleFileSelect}
        researchQuestion={researchQuestion}
        onResearchQuestionChange={handleResearchQuestionChange}
        selectedTypes={selectedTypes}
        onToggleType={handleToggleType}
        model={model}
        onModelChange={setModel}
        onExtract={() => void handleExtract()}
        canExtract={canExtract}
        isExtracting={isExtracting}
        hasExtracted={hasExtracted}
        extractionError={extractionError}
      />
      <MainContent
        nodes={nodes}
        isExtracting={isExtracting}
        hasExtracted={hasExtracted}
      />
    </div>
  );
};

export default ExtractNodesPage;
