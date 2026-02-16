"use client";

import { useEffect, useRef, useState } from "react";
import type { ModelInfo } from "~/api/ai/models/route";
import {
  NODE_TYPES,
  NODE_TYPE_COLORS,
  NODE_TYPE_LABELS,
} from "~/types/extraction";
import type { NodeType } from "~/types/extraction";

type SidebarProps = {
  file: File | null;
  onFileChange: (f: File) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  models: ModelInfo[];
  modelsLoading: boolean;
  researchQuestion: string;
  onResearchQuestionChange: (q: string) => void;
  selectedTypes: Set<NodeType>;
  onToggleType: (type: NodeType) => void;
  onExtract: () => void;
  extracting: boolean;
  hasResults: boolean;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Sidebar = ({
  file,
  onFileChange,
  selectedModel,
  onModelChange,
  models,
  modelsLoading,
  researchQuestion,
  onResearchQuestionChange,
  selectedTypes,
  onToggleType,
  onExtract,
  extracting,
  hasResults,
}: SidebarProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile?.type === "application/pdf") {
      onFileChange(uploadedFile);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile?.type === "application/pdf") {
      onFileChange(droppedFile);
    }
  };

  const canExtract =
    Boolean(file) &&
    selectedTypes.size > 0 &&
    Boolean(selectedModel) &&
    !extracting;

  const extractHint = !file
    ? "Upload a PDF to get started."
    : selectedTypes.size === 0
      ? "Choose at least one node type."
      : !selectedModel
        ? "Select a model to continue."
        : "Ready to run extraction.";

  const sectionLabelClass =
    "mb-3 block px-1 text-[18px] font-semibold tracking-[-0.016em] text-slate-800";
  const controlClassName =
    "w-full rounded-xl border border-slate-300 bg-white text-[16px] text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-all hover:border-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";
  const selectedModelInfo =
    models.find((model) => model.id === selectedModel) ?? models[0];

  useEffect(() => {
    if (!isModelMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (modelMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsModelMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsModelMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isModelMenuOpen]);

  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-[24px] border border-slate-200/85 bg-white shadow-[0_26px_52px_-38px_rgba(15,23,42,0.6)] lg:w-[390px] xl:w-[420px]">
      <div className="flex-1 overflow-y-auto p-4 lg:p-5">
        <section className="mb-6">
          <h3 className={sectionLabelClass}>Paper</h3>

          {file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="group relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition-all hover:border-slate-300 hover:shadow-[0_14px_24px_-22px_rgba(15,23,42,0.65)]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-rose-500 to-rose-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
                <span className="text-[11px] font-bold tracking-[0.02em] text-white">
                  PDF
                </span>
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-[16px] font-semibold leading-tight text-slate-900">
                  {file.name}
                </p>
                <p className="mt-1 text-[14px] leading-tight text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(1)} MB &middot;{" "}
                  <span className="font-medium text-slate-500 transition-colors group-hover:text-sky-700">
                    Replace file
                  </span>
                </p>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex w-full flex-col items-center gap-2.5 rounded-2xl border-[1.8px] border-dashed px-4 py-9 text-center transition-all ${
                dragOver
                  ? "border-sky-400 bg-sky-50/80"
                  : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-[0_10px_24px_-20px_rgba(15,23,42,0.75)]">
                <svg
                  className="h-5 w-5 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div>
                <p className="text-[18px] font-semibold tracking-[-0.02em] text-slate-800">
                  Upload PDF
                </p>
                <p className="mt-1 text-[14px] text-slate-500">
                  Drop file here or click to browse
                </p>
              </div>
            </button>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileInput}
          />
        </section>

        <section className="mb-6">
          <label htmlFor="sidebar-model" className={sectionLabelClass}>
            Model
          </label>

          {modelsLoading ? (
            <div className="h-[46px] animate-pulse rounded-xl bg-slate-100" />
          ) : (
            <div className="relative" ref={modelMenuRef}>
              <button
                id="sidebar-model"
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isModelMenuOpen}
                onClick={() => setIsModelMenuOpen((current) => !current)}
                className={`${controlClassName} flex items-center justify-between py-3 pl-3.5 pr-3.5 text-left font-medium ${
                  isModelMenuOpen
                    ? "border-slate-500 ring-2 ring-slate-200"
                    : ""
                }`}
              >
                <span className="truncate">
                  {selectedModelInfo?.displayName ?? "Select model"}
                </span>
                <svg
                  className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isModelMenuOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {isModelMenuOpen && (
                <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-300 bg-white shadow-[0_18px_30px_-22px_rgba(15,23,42,0.7)]">
                  <ul
                    role="listbox"
                    aria-labelledby="sidebar-model"
                    className="max-h-72 overflow-y-auto py-1"
                  >
                    {models.map((model) => {
                      const isActive = model.id === selectedModel;
                      return (
                        <li key={model.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onClick={() => {
                              onModelChange(model.id);
                              setIsModelMenuOpen(false);
                            }}
                            className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[15px] transition-colors ${
                              isActive
                                ? "bg-slate-100 font-semibold text-slate-900"
                                : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <span className="truncate">
                              {model.displayName}
                            </span>
                            {isActive && (
                              <svg
                                className="h-4 w-4 shrink-0 text-slate-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="mb-5">
          <label htmlFor="sidebar-rq" className={sectionLabelClass}>
            Research Question
          </label>
          <textarea
            id="sidebar-rq"
            placeholder="Optional: focus extraction on a specific claim or method"
            value={researchQuestion}
            onChange={(event) => onResearchQuestionChange(event.target.value)}
            rows={3}
            className={`${controlClassName} resize-none px-3.5 py-3 placeholder:text-slate-400`}
          />
        </section>

        <div className="mx-1 mb-5 border-t border-slate-200" />

        <section>
          <div className="mb-2.5 flex items-center justify-between px-1">
            <h3 className="text-[18px] font-semibold tracking-[-0.016em] text-slate-800">
              Node Types
            </h3>
            <span className="text-[13px] font-semibold tabular-nums text-slate-500">
              {selectedTypes.size}/{NODE_TYPES.length}
            </span>
          </div>

          <div className="space-y-1.5">
            {NODE_TYPES.map((type) => {
              const isChecked = selectedTypes.has(type);
              const color = NODE_TYPE_COLORS[type];

              return (
                <button
                  key={type}
                  type="button"
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all ${
                    isChecked
                      ? "border-slate-200 bg-white text-slate-800 shadow-[0_10px_22px_-24px_rgba(15,23,42,0.55)]"
                      : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-white"
                  }`}
                  onClick={() => onToggleType(type)}
                >
                  <div
                    className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] transition-all"
                    style={{
                      backgroundColor: isChecked ? color : "transparent",
                      boxShadow: isChecked
                        ? `0 1px 2px ${color}40, inset 0 1px 0 rgba(255,255,255,0.15)`
                        : "inset 0 0 0 1.8px #cbd5e1",
                    }}
                  >
                    {isChecked && (
                      <svg
                        className="h-[10px] w-[10px] text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-[16px] font-medium">
                    {NODE_TYPE_LABELS[type]}
                  </span>
                  <span className="ml-auto text-[12px] font-semibold text-slate-400">
                    {type}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="relative z-50 border-t border-slate-200/90 bg-white/95 p-4 backdrop-blur-xl">
        <p className="mb-2 text-[14px] font-medium text-slate-500">
          {extractHint}
        </p>
        <button
          type="button"
          onClick={onExtract}
          disabled={!canExtract}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-[17px] font-semibold transition-all ${
            canExtract
              ? "bg-gradient-to-b from-slate-800 to-slate-900 text-white shadow-[0_14px_24px_-18px_rgba(15,23,42,0.85),inset_0_1px_0_rgba(255,255,255,0.12)] hover:from-slate-700 hover:to-slate-800 active:from-slate-900 active:to-slate-950"
              : "cursor-not-allowed bg-slate-100 text-slate-400"
          }`}
        >
          {extracting && (
            <div className="h-4 w-4 animate-spin rounded-full border-[2px] border-white/25 border-t-white" />
          )}
          {extracting
            ? "Extracting..."
            : hasResults
              ? "Re-Extract"
              : "Run Extraction"}
        </button>
      </div>
    </aside>
  );
};
