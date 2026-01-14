import { App, Modal, Notice } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import { StrictMode, useState, useEffect, useCallback, useRef } from "react";
import type DiscourseGraphPlugin from "../index";
import { BulkImportCandidate, BulkImportPattern } from "~/types";
import { QueryEngine } from "~/services/QueryEngine";
import { TFile } from "obsidian";
import { getNodeTypeById } from "~/utils/typeUtils";

type BulkImportModalProps = {
  plugin: DiscourseGraphPlugin;
  onClose: () => void;
};

const BulkImportContent = ({ plugin, onClose }: BulkImportModalProps) => {
  const [step, setStep] = useState<"patterns" | "review" | "identifying">(
    "patterns",
  );
  const [patterns, setPatterns] = useState<BulkImportPattern[]>([]);
  const [candidates, setCandidates] = useState<BulkImportCandidate[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [identificationProgress, setIdentificationProgress] = useState({
    current: 0,
    total: 0,
  });

  const queryEngineRef = useRef<QueryEngine | null>(null);

  useEffect(() => {
    if (!queryEngineRef.current) {
      queryEngineRef.current = new QueryEngine(plugin.app);
    }
  }, [plugin.app]);

  const getDirectoryPath = (file: TFile): string => {
    return file.parent?.path !== "/" && file.parent?.path
      ? "/" + file.parent?.path
      : "(Root)";
  };

  useEffect(() => {
    const initialPatterns = plugin.settings.nodeTypes.map((nodeType) => ({
      nodeTypeId: nodeType.id,
      alternativePattern: nodeType.format,
      enabled: false,
    }));
    setPatterns(initialPatterns);
  }, [plugin.settings.nodeTypes]);

  const handlePatternChange = ({
    index,
    field,
    value,
  }: {
    index: number;
    field: keyof BulkImportPattern;
    value: string | boolean;
  }) => {
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
      const validNodeTypes = plugin.settings.nodeTypes;
      const foundCandidates =
        await queryEngineRef.current.scanForBulkImportCandidates(
          enabledPatterns,
          validNodeTypes,
        );

      setCandidates(foundCandidates);
      setStep("review");
    } catch (error) {
      console.warn("Error scanning vault:", error);
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

  const handleFolderToggle = (folderPath: string) => {
    setCandidates((prev) => {
      const folderCandidates = prev.filter(
        (c) => getDirectoryPath(c.file) === folderPath,
      );
      const allSelected = folderCandidates.every((c) => c.selected);
      return prev.map((c) =>
        getDirectoryPath(c.file) === folderPath
          ? { ...c, selected: !allSelected }
          : c,
      );
    });
  };

  const handleBulkIdentify = async () => {
    const selectedCandidates = candidates.filter((c) => c.selected);
    setStep("identifying");
    setIdentificationProgress({ current: 0, total: selectedCandidates.length });

    let successCount = 0;

    for (const candidate of selectedCandidates) {
      try {
        await plugin.app.fileManager.processFrontMatter(
          candidate.file,
          (fm) => {
            fm.nodeTypeId = candidate.matchedNodeType.id;
          },
        );

        successCount++;
      } catch (fileError) {
        console.error(
          `Error processing file ${candidate.file.path}:`,
          fileError,
        );

        try {
          const fileContent = await plugin.app.vault.read(candidate.file);
          const newContent = `---\nnodeTypeId: ${candidate.matchedNodeType.id}\n---\n\n${fileContent}`;

          await plugin.app.vault.modify(candidate.file, newContent);

          successCount++;

          new Notice(
            `Problem processing ${candidate.file.basename}'s frontmatter. Preserved original content.`,
          );
        } catch (fallbackError) {
          console.error(
            `Failed fallback for ${candidate.file.path}:`,
            fallbackError,
          );
          new Notice(
            `Failed to process ${candidate.file.basename}. Skipping...`,
          );
        }
      }
      setIdentificationProgress((prev) => ({
        current: prev.current + 1,
        total: selectedCandidates.length,
      }));
    }

    const failureCount = selectedCandidates.length - successCount;

    if (failureCount > 0) {
      new Notice(
        `Identification completed with some issues:\n${successCount} files processed successfully\n${failureCount} files skipped`,
        5000,
      );
    } else {
      new Notice(
        `Successfully identified ${successCount} files as discourse nodes`,
      );
    }

    onClose();
  };

  const renderPatternsStep = () => (
    <div>
      <h3 className="mb-4">Configure Identification Patterns</h3>
      <p className="text-muted mb-4 text-sm">
        Files with title matching these patterns will be identified as discourse
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

      <div className="bg-accent/10 mb-4 rounded p-3 text-sm">
        <strong>💡 </strong> Use <code>{"{content}"}</code> as placeholder for
        the main content in your alternative patterns.
      </div>

      <div className="mb-6 h-80 overflow-y-auto rounded border p-4">
        <div className="flex flex-col gap-4">
          {patterns.map((pattern, index) => {
            const nodeType = getNodeTypeById(plugin, pattern.nodeTypeId);
            return (
              <div key={pattern.nodeTypeId} className="rounded border p-3">
                <div
                  className="mb-2 flex cursor-pointer items-center"
                  onClick={() => {
                    handlePatternChange({
                      index,
                      field: "enabled",
                      value: !pattern.enabled,
                    });
                  }}
                >
                  <input
                    type="checkbox"
                    checked={pattern.enabled}
                    onChange={() => {
                      handlePatternChange({
                        index,
                        field: "enabled",
                        value: !pattern.enabled,
                      });
                    }}
                    className="mr-2"
                  />
                  <span className="font-medium">{nodeType?.name}</span>
                </div>

                {pattern.enabled && (
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder={`e.g., for "${nodeType?.format}" you might use "C - {content}"`}
                      value={pattern.alternativePattern}
                      onChange={(e) =>
                        handlePatternChange({
                          index,
                          field: "alternativePattern",
                          value: e.target.value,
                        })
                      }
                      className="w-full rounded border p-2"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
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

  const renderReviewStep = () => {
    // Group candidates by directory path
    const grouped: Record<
      string,
      { candidate: BulkImportCandidate; index: number }[]
    > = {};
    candidates.forEach((candidate, idx) => {
      const dir = getDirectoryPath(candidate.file);
      if (!grouped[dir]) grouped[dir] = [];
      grouped[dir].push({ candidate, index: idx });
    });

    return (
      <div>
        <h3 className="mb-4">Review Candidates</h3>
        <p className="text-muted mb-4 text-sm">
          {candidates.length} potential matches found. Review and select which
          files to identify as discourse nodes.
        </p>

        <div className="mb-4">
          <button
            onClick={() =>
              setCandidates((prev) =>
                prev.map((c) => ({ ...c, selected: true })),
              )
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
          {Object.entries(grouped).map(([folderPath, list]) => {
            const allSelected = list.every((l) => l.candidate.selected);
            const someSelected =
              list.some((l) => l.candidate.selected) && !allSelected;
            return (
              <div key={folderPath} className="border-b">
                <div className="bg-muted/10 flex items-center px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={() => handleFolderToggle(folderPath)}
                    className="mr-2"
                  />
                  <span className="mr-2">📂</span>
                  <span className="text-accent-foreground line-clamp-1 font-medium italic">
                    {folderPath}
                  </span>
                </div>

                {list.map(({ candidate, index }) => (
                  <div
                    key={candidate.file.path}
                    className="flex items-start border-t p-3 pl-8"
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
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-between">
          <button onClick={() => setStep("patterns")}>Back</button>
          <button
            onClick={handleBulkIdentify}
            className="!bg-accent !text-on-accent rounded px-4 py-2"
            disabled={candidates.filter((c) => c.selected).length === 0}
          >
            Identify selected as discourse nodes (
            {candidates.filter((c) => c.selected).length})
          </button>
        </div>
      </div>
    );
  };

  const renderIdentifyingStep = () => (
    <div className="text-center">
      <h3 className="mb-4">Identifying files as discourse nodes</h3>
      <div className="mb-4">
        <div className="bg-modifier-border mb-2 h-2 rounded-full">
          <div
            className="bg-accent h-2 rounded-full transition-all duration-300"
            style={{
              width: `${(identificationProgress.current / identificationProgress.total) * 100}%`,
            }}
          />
        </div>
        <div className="text-muted text-sm">
          {identificationProgress.current} of {identificationProgress.total}{" "}
          files processed
        </div>
      </div>
    </div>
  );

  switch (step) {
    case "patterns":
      return renderPatternsStep();
    case "review":
      return renderReviewStep();
    case "identifying":
      return renderIdentifyingStep();
    default:
      return null;
  }
};

export class BulkIdentifyDiscourseNodesModal extends Modal {
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
