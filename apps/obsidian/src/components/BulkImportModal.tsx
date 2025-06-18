import { App, Modal, Notice } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import { StrictMode, useState, useEffect, useCallback, useRef } from "react";
import type DiscourseGraphPlugin from "../index";
import { BulkImportCandidate, BulkImportPattern } from "~/types";
import { QueryEngine } from "~/services/QueryEngine";

type BulkImportModalProps = {
  plugin: DiscourseGraphPlugin;
  onClose: () => void;
};

const BulkImportContent = ({ plugin, onClose }: BulkImportModalProps) => {
  const [step, setStep] = useState<"patterns" | "review" | "importing">(
    "patterns",
  );
  const [patterns, setPatterns] = useState<BulkImportPattern[]>([]);
  const [candidates, setCandidates] = useState<BulkImportCandidate[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
  });

  const queryEngineRef = useRef<QueryEngine | null>(null);

  useEffect(() => {
    if (!queryEngineRef.current) {
      queryEngineRef.current = new QueryEngine(plugin.app);
    }
  }, [plugin.app]);

  const getDirectoryPath = (filePath: string): string => {
    const pathParts = filePath.split("/");
    pathParts.pop();
    const dirPath = pathParts.join("/");
    return "/" + (dirPath || "(Root)");
  };

  useEffect(() => {
    const initialPatterns = plugin.settings.nodeTypes.map((nodeType) => ({
      nodeTypeId: nodeType.id,
      alternativePattern: nodeType.format,
      enabled: false,
    }));
    setPatterns(initialPatterns);
  }, [plugin.settings.nodeTypes]);

  const handlePatternChange = (
    index: number,
    field: keyof BulkImportPattern,
    value: string | boolean,
  ) => {
    setPatterns((prev) =>
      prev.map((pattern, i) =>
        i === index ? { ...pattern, [field]: value } : pattern,
      ),
    );
  };

  const handleScanVault = useCallback(async () => {
    const enabledPatterns = patterns.filter(
      (p) => p.enabled && p.alternativePattern.trim(),
    );

    if (!queryEngineRef.current) {
      new Notice("Query engine not initialized");
      return;
    }

    setIsScanning(true);
    try {
      const validNodeTypeIds = new Set(
        plugin.settings.nodeTypes.map((nt) => nt.id),
      );
      const foundCandidates =
        await queryEngineRef.current.scanForBulkImportCandidates(
          enabledPatterns,
          validNodeTypeIds,
        );

      // Resolve node types for candidates
      const resolvedCandidates = foundCandidates
        .map((candidate) => {
          const nodeType = plugin.settings.nodeTypes.find(
            (nt) => nt.id === candidate.matchedNodeType.id,
          );
          return {
            ...candidate,
            matchedNodeType: nodeType!,
          };
        })
        .filter((candidate) => candidate.matchedNodeType); // Filter out any that couldn't be resolved

      setCandidates(resolvedCandidates);
      setStep("review");
    } catch (error) {
      console.error("Error scanning vault:", error);
      new Notice("Error scanning vault for candidates");
    } finally {
      setIsScanning(false);
    }
  }, [patterns, plugin]);

  const handleCandidateToggle = (index: number) => {
    setCandidates((prev) =>
      prev.map((candidate, i) =>
        i === index
          ? { ...candidate, selected: !candidate.selected }
          : candidate,
      ),
    );
  };

  const handleBulkImport = async () => {
    const selectedCandidates = candidates.filter((c) => c.selected);
    setStep("importing");
    setImportProgress({ current: 0, total: selectedCandidates.length });

    try {
      for (let i = 0; i < selectedCandidates.length; i++) {
        const candidate = selectedCandidates[i];
        if (!candidate) {
          continue;
        }

        await plugin.app.fileManager.processFrontMatter(
          candidate.file,
          (fm) => {
            fm.nodeTypeId = candidate.matchedNodeType.id;
          },
        );

        setImportProgress({ current: i + 1, total: selectedCandidates.length });
      }

      new Notice(
        `Successfully processed ${selectedCandidates.length} files as discourse nodes`,
      );
      onClose();
    } catch (error) {
      console.error("Error during bulk import:", error);
      new Notice("Error during bulk import");
    }
  };

  const renderPatternsStep = () => (
    <div>
      <h3 className="mb-4">Configure Import Patterns</h3>
      <p className="text-muted mb-4 text-sm">
        Files with title matching these patterns will be converted to discourse
        nodes.
      </p>

      <div className="mb-4">
        <button
          onClick={() =>
            setPatterns((prev) => prev.map((p) => ({ ...p, enabled: true })))
          }
          className="mr-2 rounded border px-3 py-1 text-sm"
        >
          Enable All
        </button>
        <button
          onClick={() =>
            setPatterns((prev) => prev.map((p) => ({ ...p, enabled: false })))
          }
          className="rounded border px-3 py-1 text-sm"
        >
          Disable All
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {patterns.map((pattern, index) => {
          const nodeType = plugin.settings.nodeTypes.find(
            (n) => n.id === pattern.nodeTypeId,
          );
          return (
            <div key={pattern.nodeTypeId} className="rounded border">
              <div
                className="mb-2 flex items-center"
                onClick={() => {
                  handlePatternChange(index, "enabled", !pattern.enabled);
                }}
              >
                <input
                  type="checkbox"
                  checked={pattern.enabled}
                  onChange={() => {
                    handlePatternChange(index, "enabled", !pattern.enabled);
                  }}
                  className="mr-2"
                />
                <span className="font-medium">{nodeType?.name}</span>
              </div>

              {pattern.enabled && (
                <div>
                  <input
                    type="text"
                    placeholder={`e.g., for "${nodeType?.format}" you might use "C - {content}"`}
                    value={pattern.alternativePattern}
                    onChange={(e) =>
                      handlePatternChange(
                        index,
                        "alternativePattern",
                        e.target.value,
                      )
                    }
                    className="w-full rounded border p-2"
                  />
                  <div className="text-muted mt-1 text-xs">
                    Use {"{content}"} as placeholder for the main content
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-between">
        <button onClick={onClose} className="px-4 py-2">
          Cancel
        </button>
        <button
          onClick={handleScanVault}
          disabled={isScanning || patterns.every((p) => !p.enabled)}
          className="!bg-accent !text-on-accent rounded px-4 py-2"
        >
          {isScanning ? "Scanning..." : "Scan Vault"}
        </button>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div>
      <h3 className="mb-4">Review Import Candidates</h3>
      <p className="text-muted mb-4 text-sm">
        {candidates.length} potential matches found. Review and select which
        files to import.
      </p>

      <div className="mb-4">
        <button
          onClick={() =>
            setCandidates((prev) => prev.map((c) => ({ ...c, selected: true })))
          }
          className="mr-2 rounded border px-3 py-1 text-sm"
        >
          Select All
        </button>
        <button
          onClick={() =>
            setCandidates((prev) =>
              prev.map((c) => ({ ...c, selected: false })),
            )
          }
          className="rounded border px-3 py-1 text-sm"
        >
          Deselect All
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto rounded border">
        {candidates.map((candidate, index) => (
          <div
            key={candidate.file.path}
            className="flex items-start border-b p-3"
          >
            <input
              type="checkbox"
              checked={candidate.selected}
              onChange={() => handleCandidateToggle(index)}
              className="mr-3 mt-1 flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="line-clamp-3 font-medium">
                {candidate.file.basename}
              </div>
              <div className="text-muted text-sm">
                {getDirectoryPath(candidate.file.path)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-between">
        <button onClick={() => setStep("patterns")} className="px-4 py-2">
          Back
        </button>
        <button
          onClick={handleBulkImport}
          className="!bg-accent !text-on-accent rounded px-4 py-2"
          disabled={candidates.filter((c) => c.selected).length === 0}
        >
          Import Selected ({candidates.filter((c) => c.selected).length})
        </button>
      </div>
    </div>
  );

  const renderImportingStep = () => (
    <div className="text-center">
      <h3 className="mb-4">Importing Files</h3>
      <div className="mb-4">
        <div className="bg-modifier-border mb-2 h-2 rounded-full">
          <div
            className="bg-accent h-2 rounded-full transition-all duration-300"
            style={{
              width: `${(importProgress.current / importProgress.total) * 100}%`,
            }}
          />
        </div>
        <div className="text-muted text-sm">
          {importProgress.current} of {importProgress.total} files processed
        </div>
      </div>
    </div>
  );

  switch (step) {
    case "patterns":
      return renderPatternsStep();
    case "review":
      return renderReviewStep();
    case "importing":
      return renderImportingStep();
    default:
      return null;
  }
};

export class BulkImportModal extends Modal {
  private plugin: DiscourseGraphPlugin;
  private root: Root | null = null;

  constructor(app: App, plugin: DiscourseGraphPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.root = createRoot(contentEl);
    this.root.render(
      <StrictMode>
        <BulkImportContent plugin={this.plugin} onClose={() => this.close()} />
      </StrictMode>,
    );
  }

  onClose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
