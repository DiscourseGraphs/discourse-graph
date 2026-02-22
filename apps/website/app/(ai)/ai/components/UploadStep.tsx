"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { NODE_TYPES, NODE_TYPE_LABELS } from "~/types/extraction";
import type { NodeType } from "~/types/extraction";
import type { ModelInfo } from "~/api/ai/models/route";

export type SubmitParams = {
  file: File;
  nodeTypes: NodeType[];
  model: string;
  researchQuestion?: string;
};

type UploadStepProps = {
  onSubmit: (params: SubmitParams) => void | Promise<void>;
  loading: boolean;
  models: ModelInfo[];
  modelsLoading: boolean;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const UploadStep = ({ onSubmit, loading, models, modelsLoading }: UploadStepProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [researchQuestion, setResearchQuestion] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<NodeType>>(
    new Set(NODE_TYPES),
  );
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-select first model once loaded
  const modelValue = selectedModel || (models[0]?.id ?? "");

  const handleFile = useCallback((f: File) => {
    if (f.type !== "application/pdf") {
      alert("Please upload a PDF file.");
      return;
    }
    setFile(f);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

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

  const handleSubmit = () => {
    if (!file || selectedTypes.size === 0 || !modelValue) return;
    void onSubmit({
      file,
      nodeTypes: Array.from(selectedTypes),
      model: modelValue,
      researchQuestion: researchQuestion.trim() || undefined,
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-8">
      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-bold text-neutral-dark">
          AI Discourse Graph Extraction
        </h1>
        <p className="text-lg text-neutral-dark/70">
          Upload an academic paper to extract structured discourse graph nodes.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-50"
            : file
              ? "border-green-500 bg-green-50"
              : "border-gray-300 hover:border-gray-400"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {file ? (
          <div className="text-center">
            <p className="text-lg font-medium text-green-700">{file.name}</p>
            <p className="text-base text-green-600">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Click or drop to replace
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-lg font-medium text-gray-600">
              Drag & drop a PDF here, or click to browse
            </p>
            <p className="mt-1 text-base text-gray-400">PDF files only</p>
          </div>
        )}
      </div>

      {/* Research question */}
      <div className="space-y-2">
        <label htmlFor="research-question" className="text-base font-medium text-gray-900">
          Research question (optional)
        </label>
        <textarea
          id="research-question"
          placeholder="e.g., How does X affect Y in Z context?"
          value={researchQuestion}
          onChange={(e) => setResearchQuestion(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-sm text-gray-500">
          Providing a research question helps focus the extraction on relevant nodes.
        </p>
      </div>

      {/* Model selection */}
      <div className="space-y-2">
        <label htmlFor="model-select" className="text-base font-medium text-gray-900">
          Model
        </label>
        {modelsLoading ? (
          <p className="text-base text-gray-500">Loading models...</p>
        ) : (
          <select
            id="model-select"
            value={modelValue}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Node type selection */}
      <div className="space-y-3">
        <span className="text-base font-medium text-gray-900">
          Node types to extract
        </span>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 md:grid-cols-4">
          {NODE_TYPES.map((type) => (
            <label
              key={type}
              className="flex cursor-pointer items-center space-x-2"
            >
              <Checkbox
                checked={selectedTypes.has(type)}
                onCheckedChange={() => toggleType(type)}
                className="h-5 w-5"
              />
              <span className="text-base text-gray-900">{NODE_TYPE_LABELS[type]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={!file || selectedTypes.size === 0 || !modelValue || loading}
        className="w-full py-6 text-lg"
      >
        {loading ? "Processing..." : "Run Extraction"}
      </Button>
    </div>
  );
};
