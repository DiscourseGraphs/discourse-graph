"use client";
import { useRef } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { ChevronDown, Upload } from "lucide-react";
import { NODE_TYPE_DEFINITIONS } from "~/types/extraction";

const SECTION_LABEL_CLASS =
  "mb-3 block px-1 text-lg font-semibold tracking-tight text-slate-800";

type SidebarProps = {
  pdfFile: File | null;
  onFileSelect: (file: File) => void;
  researchQuestion: string;
  onResearchQuestionChange: (value: string) => void;
  selectedTypes: Set<string>;
  onToggleType: (candidateTag: string) => void;
};

export const Sidebar = ({
  pdfFile,
  onFileSelect,
  researchQuestion,
  onResearchQuestionChange,
  selectedTypes,
  onToggleType,
}: SidebarProps): React.ReactElement => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file?.type === "application/pdf") {
      onFileSelect(file);
    }
    event.target.value = "";
  };

  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-xl lg:w-96">
      <div className="flex-1 overflow-y-auto p-4 lg:p-5">
        <section className="mb-6">
          <h3 className={SECTION_LABEL_CLASS}>Paper</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileInput}
          />
          {pdfFile ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="group h-auto w-full items-start justify-start gap-3 whitespace-normal rounded-2xl border-slate-200 p-3.5 text-left hover:border-slate-300 hover:bg-white"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-rose-500 to-rose-600">
                <span className="text-xs font-bold tracking-wide text-white">
                  PDF
                </span>
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-base font-semibold leading-tight text-slate-900">
                  {pdfFile.name}
                </p>
                <p className="mt-1 text-sm leading-tight text-slate-500">
                  {(pdfFile.size / 1024 / 1024).toFixed(1)} MB &middot;{" "}
                  <span className="font-medium transition-colors group-hover:text-sky-700">
                    Replace file
                  </span>
                </p>
              </div>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="h-auto w-full flex-col gap-2.5 rounded-2xl border-2 border-dashed border-slate-300 px-4 py-9 text-center hover:border-slate-400 hover:bg-slate-50 [&_svg]:size-5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                <Upload className="text-slate-500" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-800">
                  Upload PDF
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Click to choose a file
                </p>
              </div>
            </Button>
          )}
        </section>

        <section className="mb-6">
          <h3 className={SECTION_LABEL_CLASS}>Model</h3>
          <Button
            variant="outline"
            className="w-full justify-between rounded-xl border-slate-300 px-3.5 py-3 text-base font-medium text-slate-700"
          >
            <span>Claude Sonnet 4.6</span>
            <ChevronDown className="text-slate-500" />
          </Button>
        </section>

        <section className="mb-5">
          <h3 className={SECTION_LABEL_CLASS}>Research Question</h3>
          <Textarea
            value={researchQuestion}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              onResearchQuestionChange(e.target.value)
            }
            placeholder="e.g., What are the molecular determinants of lumenoid formation in hiPSCs?"
            className="min-h-36 resize-none rounded-xl border-slate-300 bg-white px-3.5 py-3 text-base text-slate-700 placeholder:text-slate-400"
          />
        </section>

        <div className="mx-1 mb-5 border-t border-slate-200" />

        <section>
          <div className="mb-2.5 flex items-center justify-between px-1">
            <h3 className="text-lg font-semibold tracking-tight text-slate-800">
              Node Types
            </h3>
            <span className="text-xs font-semibold tabular-nums text-slate-500">
              {selectedTypes.size}/{NODE_TYPE_DEFINITIONS.length}
            </span>
          </div>

          <div className="space-y-1.5">
            {NODE_TYPE_DEFINITIONS.map((type) => (
              <Label
                key={type.candidateTag}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-slate-800 shadow-sm"
              >
                <Checkbox
                  checked={selectedTypes.has(type.candidateTag)}
                  onCheckedChange={() => onToggleType(type.candidateTag)}
                />
                <span className="min-w-0 flex-1 text-base font-medium">
                  {type.label}
                </span>
                <span className="shrink-0 text-xs font-medium text-slate-400">
                  {type.candidateTag}
                </span>
              </Label>
            ))}
          </div>
        </section>
      </div>

      <div className="border-t border-slate-200/90 bg-white/95 p-4 backdrop-blur-xl">
        <p className="mb-2 text-sm font-medium text-slate-500">
          Ready to run extraction.
        </p>
        <Button className="w-full rounded-xl bg-slate-900 py-6 text-lg font-semibold text-white hover:bg-slate-800">
          Re-Extract
        </Button>
      </div>
    </aside>
  );
};
