import { Modal, Notice } from "obsidian";
import { StrictMode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ZodError } from "zod";
import type DiscourseGraphPlugin from "~/index";
import {
  applySchemaImportSelection,
  pickAndPreviewSchemaImport,
  type ImportPreviewStats,
  type LoadedSchemaFile,
  type SpecImportApplyResult,
  type SpecImportPreview,
} from "~/utils/specImport";
import type { SchemaConflict } from "~/utils/schemaFieldDiff";
import { NativeFileDialogCancelledError } from "~/utils/nativeJsonFileDialogs";
import {
  useSchemaSelection,
  type SchemaSelectionState,
} from "~/components/useSchemaSelection";
import { SchemaSelectionPanel } from "~/components/SchemaSelectionPanel";
import { ImportSchemaPreviewSummary } from "~/components/ImportSchemaPreviewSummary";
import { SchemaFieldChoiceStep } from "~/components/SchemaFieldChoiceStep";
import { useSchemaMergePlan } from "~/components/useSchemaMergePlan";

type ImportSpecsModalProps = {
  plugin: DiscourseGraphPlugin;
  onClose: () => void;
};

/**
 * Choosing field values is a step of its own rather than part of the selection
 * list: it only concerns the subset of selected items that already exist, and
 * folding per-field choices into the selection list would bury the decision
 * that actually changes existing data.
 */
type ImportStep = "select" | "choose";

export const openImportSpecsModal = (plugin: DiscourseGraphPlugin): void => {
  new ImportSpecsModal(plugin).open();
};

/** Overlaps are computed for the whole file, so drop the ones not being imported. */
const filterConflictsToSelection = ({
  conflicts,
  selection,
}: {
  conflicts: SchemaConflict[];
  selection: SchemaSelectionState;
}): SchemaConflict[] => {
  return conflicts.filter((conflict) => {
    if (conflict.category === "nodeType") {
      return selection.selectedNodeTypeIds.has(conflict.schemaId);
    }
    if (conflict.category === "relationType") {
      return selection.selectedRelationTypeIds.has(conflict.schemaId);
    }
    return selection.selectedTemplateNames.has(conflict.schemaId);
  });
};

const buildExistingItemNotes = ({
  existingSchemaIds,
  conflicts,
  category,
}: {
  existingSchemaIds: ReadonlySet<string>;
  conflicts: SchemaConflict[];
  category: SchemaConflict["category"];
}): Map<string, string> => {
  const changeCountBySchemaId = new Map(
    conflicts
      .filter((conflict) => conflict.category === category)
      .map((conflict) => [conflict.schemaId, conflict.changes.length]),
  );
  return new Map(
    [...existingSchemaIds].map((schemaId) => {
      const changeCount = changeCountBySchemaId.get(schemaId);
      return [
        schemaId,
        changeCount
          ? `in vault, ${changeCount} field(s) differ`
          : "in vault, identical",
      ];
    }),
  );
};

const buildImportCompleteMessage = ({
  created,
  merged,
}: SpecImportApplyResult): string => {
  const createdMessage = `Import complete: ${created.nodeTypes} node type(s), ${created.relationTypes} relation type(s), ${created.discourseRelations} relation triple(s), and ${created.templates} template(s) created.`;
  const mergedTotal =
    merged.nodeTypes + merged.relationTypes + merged.templates;
  if (mergedTotal === 0) return createdMessage;
  return `${createdMessage} Updated ${merged.nodeTypes} node type(s) and ${merged.relationTypes} relation type(s), and added ${merged.templates} template copy(ies).`;
};

const ImportPreviewSelection = ({
  plugin,
  loadedSchemaFile,
  previewStats,
  conflicts,
  isApplyingImport,
  setIsApplyingImport,
  onResetPreview,
  onClose,
}: {
  plugin: DiscourseGraphPlugin;
  loadedSchemaFile: LoadedSchemaFile;
  previewStats: ImportPreviewStats;
  conflicts: SchemaConflict[];
  isApplyingImport: boolean;
  setIsApplyingImport: (value: boolean) => void;
  onResetPreview: () => void;
  onClose: () => void;
}) => {
  const [step, setStep] = useState<ImportStep>("select");
  const schemaFile = loadedSchemaFile.schemaFile;
  const source = {
    nodeTypes: schemaFile.nodeTypes,
    relationTypes: schemaFile.relationTypes,
    relationTriples: schemaFile.discourseRelations,
    templateNames: schemaFile.templates.map((template) => template.name),
  };

  const selection = useSchemaSelection({
    source,
    resetKey: loadedSchemaFile.sourcePath,
  });

  const selectedConflicts = filterConflictsToSelection({
    conflicts,
    selection,
  });

  // A merge choice only means anything while its item is still selected, so
  // changing which conflicting items are imported discards the choices made.
  const mergePlan = useSchemaMergePlan({
    resetKey: `${loadedSchemaFile.sourcePath}|${selectedConflicts
      .map((conflict) => `${conflict.category}:${conflict.schemaId}`)
      .join(",")}`,
  });

  const hasAnySelection =
    selection.selectedNodeTypeIds.size > 0 ||
    selection.selectedRelationTypeIds.size > 0 ||
    selection.selectedRelationIds.size > 0 ||
    selection.selectedTemplateNames.size > 0;

  const handleApplyImport = async (): Promise<void> => {
    setIsApplyingImport(true);
    const warnings: string[] = [];
    try {
      const result = await applySchemaImportSelection({
        plugin,
        loadedSchemaFile,
        selection: selection.asSelectionPayload(),
        mergePlan: mergePlan.asMergePlan(),
        onWarning: (message) => warnings.push(message),
      });

      new Notice(buildImportCompleteMessage(result), 7000);
      if (warnings.length > 0) {
        new Notice(`Import warnings:\n${warnings.join("\n")}`, 6000);
      }
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Failed to import schema: ${message}`, 6000);
      // Only the failure path stays mounted; the success path unmounted at onClose()
      setIsApplyingImport(false);
    }
  };

  const handleAdvanceFromSelection = (): void => {
    if (!hasAnySelection) {
      new Notice("Select at least one item to import.");
      return;
    }
    if (selectedConflicts.length > 0) {
      setStep("choose");
      return;
    }
    void handleApplyImport();
  };

  const isChoosingFields = step === "choose";
  const primaryLabel = isApplyingImport
    ? "Importing..."
    : isChoosingFields || selectedConflicts.length === 0
      ? "Import selected"
      : `Choose what to keep (${selectedConflicts.length})`;

  return (
    <div>
      <h3 className="mb-2">
        {isChoosingFields ? "Choose what to keep" : "Import schema preview"}
      </h3>
      <p className="text-muted mb-4 text-sm">
        Source file: {loadedSchemaFile.sourcePath}
      </p>

      {isChoosingFields ? (
        <SchemaFieldChoiceStep
          conflicts={selectedConflicts}
          mergePlan={mergePlan}
          sourceVaultName={schemaFile.vaultName}
        />
      ) : (
        <>
          <ImportSchemaPreviewSummary
            loadedSchemaFile={loadedSchemaFile}
            previewStats={previewStats}
          />
          <SchemaSelectionPanel
            source={source}
            selection={selection}
            onDependencyViolation={(message) => new Notice(message)}
            nodeTypeNotes={buildExistingItemNotes({
              existingSchemaIds: loadedSchemaFile.matchPlan.existingNodeTypeIds,
              conflicts,
              category: "nodeType",
            })}
            relationTypeNotes={buildExistingItemNotes({
              existingSchemaIds:
                loadedSchemaFile.matchPlan.existingRelationTypeIds,
              conflicts,
              category: "relationType",
            })}
          />
        </>
      )}

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          className="px-4 py-2"
          onClick={isChoosingFields ? () => setStep("select") : onResetPreview}
          disabled={isApplyingImport}
        >
          {isChoosingFields ? "Back" : "Choose another file"}
        </button>
        <button
          type="button"
          className="!bg-accent !text-on-accent rounded px-4 py-2"
          onClick={
            isChoosingFields
              ? () => void handleApplyImport()
              : handleAdvanceFromSelection
          }
          disabled={isApplyingImport}
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
};

const ImportSpecsContent = ({ plugin, onClose }: ImportSpecsModalProps) => {
  const [preview, setPreview] = useState<SpecImportPreview | null>(null);
  const [isSelectingFile, setIsSelectingFile] = useState(false);
  const [isApplyingImport, setIsApplyingImport] = useState(false);

  const handleSelectSchemaFile = async (): Promise<void> => {
    setIsSelectingFile(true);
    try {
      const nextPreview = await pickAndPreviewSchemaImport({ plugin });
      setPreview(nextPreview);
    } catch (error) {
      if (error instanceof NativeFileDialogCancelledError) return;
      if (error instanceof ZodError) {
        const fields = error.issues.map((i) => i.path.join(".")).join(", ");
        new Notice(
          `Schema file is incompatible with this version of the plugin. Invalid or missing fields: ${fields}`,
          8000,
        );
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Failed to load schema file: ${message}`, 6000);
    } finally {
      setIsSelectingFile(false);
    }
  };

  if (!preview) {
    return (
      <div>
        <h3 className="mb-2">Import discourse graph schema</h3>
        <p className="text-muted mb-4 text-sm">
          Pick a <code>dg-schema-*.json</code> file from your computer to
          preview and choose exactly what to import.
        </p>

        <div className="mb-4 rounded border p-3 text-sm">
          Same dependency rules as export apply here during selection.
        </div>

        <div className="flex justify-between">
          <button type="button" className="px-4 py-2" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="!bg-accent !text-on-accent rounded px-4 py-2"
            onClick={() => void handleSelectSchemaFile()}
            disabled={isSelectingFile}
          >
            {isSelectingFile ? "Opening..." : "Choose schema file"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <ImportPreviewSelection
      plugin={plugin}
      loadedSchemaFile={preview.loadedSchemaFile}
      previewStats={preview.previewStats}
      conflicts={preview.conflicts}
      isApplyingImport={isApplyingImport}
      setIsApplyingImport={setIsApplyingImport}
      onResetPreview={() => setPreview(null)}
      onClose={onClose}
    />
  );
};

export class ImportSpecsModal extends Modal {
  private plugin: DiscourseGraphPlugin;
  private root: Root | null = null;

  constructor(plugin: DiscourseGraphPlugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.contentEl.empty();
    this.root = createRoot(this.contentEl);
    this.root.render(
      <StrictMode>
        <ImportSpecsContent plugin={this.plugin} onClose={() => this.close()} />
      </StrictMode>,
    );
  }

  onClose(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
