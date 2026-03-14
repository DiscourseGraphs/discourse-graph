"use client";

import type { ExtractionResult } from "~/types/extraction";
import { ResultsPanel } from "./ResultsPanel";

type MainContentProps = {
  state: "idle" | "processing" | "results" | "error";
  result: ExtractionResult | null;
  error: string | null;
  fileName?: string;
  modelName?: string;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const MainContent = ({
  state,
  result,
  error,
  fileName,
  modelName,
}: MainContentProps) => {
  const panelClassName =
    "flex min-h-[420px] flex-1 overflow-hidden rounded-[24px] border border-slate-200/85 bg-white shadow-[0_24px_48px_-36px_rgba(15,23,42,0.55)]";

  if (state === "processing") {
    return (
      <section className={panelClassName}>
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <div className="rounded-2xl border border-slate-200/85 bg-white/90 px-8 py-8 text-center shadow-[0_24px_42px_-30px_rgba(15,23,42,0.65)]">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900/95 shadow-[0_14px_26px_-16px_rgba(15,23,42,0.8)]">
              <div className="relative h-7 w-7">
                <div className="absolute inset-0 rounded-full border-[2.6px] border-white/25" />
                <div className="absolute inset-0 animate-spin rounded-full border-[2.6px] border-transparent border-t-white" />
              </div>
            </div>

            <p className="text-[23px] font-semibold tracking-[-0.022em] text-slate-900">
              Extracting discourse nodes
            </p>
            {fileName && modelName && (
              <p className="mt-2 text-[14px] text-slate-500">
                {fileName} &middot; {modelName}
              </p>
            )}
            <p className="mt-4 text-[13px] text-slate-400">
              This can take up to a minute for longer papers.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className={panelClassName}>
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-rose-200/70 bg-white px-6 py-7 text-center shadow-[0_22px_42px_-30px_rgba(190,24,93,0.35)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-rose-100 bg-rose-50">
              <svg
                className="h-6 w-6 text-rose-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>

            <div>
              <p className="text-[23px] font-semibold tracking-[-0.022em] text-slate-900">
                Extraction failed
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                {error}
              </p>
            </div>

            <p className="text-[13px] text-slate-400">
              Check your sidebar settings and try again.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (state === "results" && result) {
    return (
      <section className={panelClassName}>
        <ResultsPanel result={result} />
      </section>
    );
  }

  return (
    <section className={panelClassName}>
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <div className="max-w-xl rounded-2xl border border-slate-200/85 bg-white/95 px-8 py-9 text-center shadow-[0_24px_44px_-32px_rgba(15,23,42,0.72)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.7}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          </div>

          <p className="mt-5 text-[27px] font-semibold tracking-[-0.03em] text-slate-900">
            No results yet
          </p>
          <p className="mt-2 text-[15px] text-slate-500">
            Upload a paper, choose what to extract, then run extraction.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[13px] font-semibold text-slate-600">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
              1. Upload PDF
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
              2. Set model
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
              3. Run extraction
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
