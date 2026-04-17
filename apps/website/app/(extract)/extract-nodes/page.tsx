"use client";

import { useCallback, useState } from "react";
import { MainContent } from "./components/MainContent";
import { Sidebar } from "./components/Sidebar";

const ExtractNodesPage = (): React.ReactElement => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [researchQuestion, setResearchQuestion] = useState("");
  const [selectedTypes, setSelectedTypes] = useState(
    () => new Set(["#evd-candidate", "#clm-candidate"]),
  );

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

  return (
    <div className="flex h-full w-full flex-1 flex-col gap-4 p-4 lg:flex-row lg:gap-5 lg:p-5">
      <Sidebar
        pdfFile={pdfFile}
        onFileSelect={setPdfFile}
        researchQuestion={researchQuestion}
        onResearchQuestionChange={setResearchQuestion}
        selectedTypes={selectedTypes}
        onToggleType={toggleType}
      />
      <MainContent />
    </div>
  );
};

export default ExtractNodesPage;
