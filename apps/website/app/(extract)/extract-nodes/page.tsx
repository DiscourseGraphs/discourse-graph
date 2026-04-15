"use client";

import { useCallback, useState } from "react";
import { DEFAULT_MODEL_ID, NODE_TYPE_DEFINITIONS } from "~/types/extraction";
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

const ExtractNodesPage = (): React.ReactElement => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [researchQuestion, setResearchQuestion] = useState("");
  const [selectedTypes, setSelectedTypes] = useState(
    () => new Set(["#evd-candidate", "#clm-candidate"]),
  );
  const [model, setModel] = useState(DEFAULT_MODEL_ID);
  const [isExtracting, setIsExtracting] = useState(false);

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
    try {
      const pdfBase64 = await readFileAsBase64(pdfFile);
      const nodeTypes = NODE_TYPE_DEFINITIONS.filter((t) =>
        selectedTypes.has(t.candidateTag),
      );
      const systemPrompt = buildSystemPrompt(nodeTypes);
      const requestBody = {
        pdfBase64,
        provider: "anthropic",
        model,
        researchQuestion: researchQuestion || undefined,
        systemPrompt,
      };
      console.log("extraction request body:", requestBody);
      console.log("extraction system prompt:\n" + systemPrompt);
      const response = await fetch("/api/ai/extract", {
        method: "POST",
        // eslint-disable-next-line @typescript-eslint/naming-convention
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const json: unknown = await response.json();
      console.log("extraction result:", json);
    } catch (error) {
      console.error("extraction failed:", error);
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
      />
      <MainContent />
    </div>
  );
};

export default ExtractNodesPage;
