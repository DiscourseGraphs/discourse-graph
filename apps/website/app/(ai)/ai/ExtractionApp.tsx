"use client";

import { useCallback, useState } from "react";
import { NODE_TYPES } from "~/types/extraction";
import type { ExtractionResult, NodeType } from "~/types/extraction";
import { MainContent } from "./components/MainContent";
import { Sidebar } from "./components/Sidebar";
import { useExtraction } from "./hooks/useExtraction";
import { useModels } from "./hooks/useModels";
import { usePdfParser } from "./hooks/usePdfParser";

type AppState = "idle" | "processing" | "results" | "error";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ExtractionApp = () => {
  const [file, setFile] = useState<File | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<NodeType>>(
    () => new Set(NODE_TYPES),
  );

  const [appState, setAppState] = useState<AppState>("idle");
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pdfParser = usePdfParser();
  const extraction = useExtraction();
  const modelsHook = useModels();

  const modelValue = selectedModel || (modelsHook.models[0]?.id ?? "");

  const toggleType = useCallback((type: NodeType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleExtract = useCallback(async () => {
    if (!file || selectedTypes.size === 0 || !modelValue) {
      return;
    }

    setAppState("processing");
    setError(null);

    const parsed = await pdfParser.parse(file);
    if (!parsed) {
      setError(pdfParser.error ?? "Failed to parse PDF");
      setAppState("error");
      return;
    }

    const extractionResult = await extraction.extract({
      paperText: parsed.text,
      nodeTypes: Array.from(selectedTypes),
      model: modelValue,
      researchQuestion: researchQuestion.trim() || undefined,
    });

    if (!extractionResult) {
      setError(extraction.error ?? "Extraction failed");
      setAppState("error");
      return;
    }

    setResult(extractionResult);
    setAppState("results");
  }, [
    extraction,
    file,
    modelValue,
    pdfParser,
    researchQuestion,
    selectedTypes,
  ]);

  return (
    <div className="flex h-full w-full flex-1 flex-col gap-4 p-4 lg:flex-row lg:gap-5 lg:p-5">
      <Sidebar
        file={file}
        onFileChange={setFile}
        selectedModel={modelValue}
        onModelChange={setSelectedModel}
        models={modelsHook.models}
        modelsLoading={modelsHook.loading}
        researchQuestion={researchQuestion}
        onResearchQuestionChange={setResearchQuestion}
        selectedTypes={selectedTypes}
        onToggleType={toggleType}
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onExtract={handleExtract}
        extracting={appState === "processing"}
        hasResults={appState === "results"}
      />
      <MainContent
        state={appState}
        result={result}
        error={error}
        fileName={file?.name}
        modelName={modelValue}
      />
    </div>
  );
};
