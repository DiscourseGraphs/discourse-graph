import { App, Notice } from "obsidian";
import { useMemo, useState } from "react";
import type DiscourseGraphPlugin from "~/index";
import {
  applySchemaImportSelection,
  ImportFileSelectionCancelledError,
  pickAndPreviewSchemaImport,
  type ImportPreviewStats,
  type LoadedSchemaFile,
  type SpecImportPreview,
} from "~/utils/specImport";
import {
  useSchemaSelection,
  type SchemaSelectionSource,
} from "~/components/useSchemaSelection";
import { SchemaSelectionModalBody } from "~/components/SchemaSelectionModalBody";
import { ImportSchemaPreviewSummary } from "~/components/ImportSchemaPreviewSummary";
import { ReactRootModal } from "~/components/ReactRootModal";

type ImportSpecsModalProps = {
  plugin: DiscourseGraphPlugin;
  onClose: () => void;
};

export const openImportSpecsModal = (plugin: DiscourseGraphPlugin): void => {
  new ImportSpecsModal(plugin.app, plugin).open();
};

const ImportPreviewSelection = ({
  plugin,
  loadedSchemaFile,
  previewStats,
  isApplyingImport,
  setIsApplyingImport,
  onResetPreview,
  onClose,
}: {
  plugin: DiscourseGraphPlugin;
  loadedSchemaFile: LoadedSchemaFile;
  previewStats: ImportPreviewStats;
  isApplyingImport: boolean;
  setIsApplyingImport: (value: boolean) => void;
  onResetPreview: () => void;
  onClose: () => void;
}) => {
  const source = useMemo<SchemaSelectionSource>(() => {
    const schemaFile = loadedSchemaFile.schemaFile;
    return {
      nodeTypes: schemaFile.nodeTypes,
      relationTypes: schemaFile.relationTypes,
      relationTriples: schemaFile.discourseRelations,
      templateNames: schemaFile.templates.map((template) => template.name),
    };
  }, [loadedSchemaFile]);

  const selection = useSchemaSelection({
    source,
    resetKey: loadedSchemaFile.sourcePath,
    initialValues: {
      nodeTypeIds: source.nodeTypes.map((nodeType) => nodeType.id),
      relationTypeIds: source.relationTypes.map(
        (relationType) => relationType.id,
      ),
      relationIds: source.relationTriples.map((relation) => relation.id),
      templateNames: source.templateNames,
    },
  });

  const handleApplyImport = async (): Promise<void> => {
    const selected = selection.asSelectionPayload();
    const hasAnySelection =
      selected.nodeTypeIds.length > 0 ||
      selected.relationTypeIds.length > 0 ||
      selected.relationIds.length > 0 ||
      selected.templateNames.length > 0;
    if (!hasAnySelection) {
      new Notice("Select at least one item to import.");
      return;
    }

    setIsApplyingImport(true);
    try {
      const result = await applySchemaImportSelection({
        plugin,
        loadedSchemaFile,
        selection: {
          nodeTypeIds: selected.nodeTypeIds,
          relationTypeIds: selected.relationTypeIds,
          discourseRelationIds: selected.relationIds,
          templateNames: selected.templateNames,
        },
      });

      new Notice(
        `Import complete: ${result.nodeTypes.created} node type(s), ${result.relationTypes.created} relation type(s), ${result.discourseRelations.created} relation triple(s), and ${result.templates.created} template(s) created.`,
        7000,
      );

      if (result.warnings.length > 0) {
        new Notice(
          `Import completed with ${result.warnings.length} warning(s).`,
          6000,
        );
        for (const warning of result.warnings) {
          new Notice(warning, 6000);
        }
      }
      onClose();
    } catch (error) {
      console.error("Failed to apply schema import:", error);
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Failed to import schema: ${message}`, 6000);
    } finally {
      setIsApplyingImport(false);
    }
  };

  return (
    <SchemaSelectionModalBody
      title="Import schema preview"
      description={`Source file: ${loadedSchemaFile.sourcePath}`}
      source={source}
      selection={selection}
      emptyTemplateText="No templates found in this schema file."
      onDependencyViolation={(message) => new Notice(message)}
      beforePanel={
        <ImportSchemaPreviewSummary
          loadedSchemaFile={loadedSchemaFile}
          previewStats={previewStats}
        />
      }
      footerSecondaryLabel="Choose another file"
      onFooterSecondaryClick={onResetPreview}
      footerPrimaryLabel={isApplyingImport ? "Importing..." : "Import selected"}
      onFooterPrimaryClick={() => void handleApplyImport()}
      isFooterSecondaryDisabled={isApplyingImport}
      isFooterPrimaryDisabled={isApplyingImport}
    />
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
      if (error instanceof ImportFileSelectionCancelledError) {
        return;
      }
      console.error("Failed to load schema import file:", error);
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
      isApplyingImport={isApplyingImport}
      setIsApplyingImport={setIsApplyingImport}
      onResetPreview={() => setPreview(null)}
      onClose={onClose}
    />
  );
};

export class ImportSpecsModal extends ReactRootModal {
  private plugin: DiscourseGraphPlugin;

  constructor(app: App, plugin: DiscourseGraphPlugin) {
    super(app);
    this.plugin = plugin;
  }

  protected renderContent() {
    return (
      <ImportSpecsContent plugin={this.plugin} onClose={() => this.close()} />
    );
  }
}
