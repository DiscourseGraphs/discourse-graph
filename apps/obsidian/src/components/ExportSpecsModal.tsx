import { App, Notice } from "obsidian";
import { useMemo, useState } from "react";
import type DiscourseGraphPlugin from "~/index";
import { exportSchemaSelection } from "~/utils/specExport";
import { NativeFileDialogCancelledError } from "~/utils/nativeJsonFileDialogs";
import { getDgSchemaFileName } from "~/utils/specValidation";
import { getTemplateFiles } from "~/utils/templates";
import {
  getReferencedTemplateNames,
  useSchemaSelection,
  type SchemaSelectionSource,
} from "~/components/useSchemaSelection";
import { SchemaSelectionModalBody } from "~/components/SchemaSelectionModalBody";
import { ReactRootModal } from "~/components/ReactRootModal";

type ExportSpecsModalProps = {
  plugin: DiscourseGraphPlugin;
  onClose: () => void;
};

export const openExportSpecsModal = (plugin: DiscourseGraphPlugin): void => {
  new ExportSpecsModal(plugin.app, plugin).open();
};

const ExportSpecsContent = ({ plugin, onClose }: ExportSpecsModalProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const outputFileName = getDgSchemaFileName(plugin.app.vault.getName());

  const source = useMemo<SchemaSelectionSource>(() => {
    return {
      nodeTypes: plugin.settings.nodeTypes,
      relationTypes: plugin.settings.relationTypes,
      relationTriples: plugin.settings.discourseRelations,
      templateNames: getTemplateFiles(plugin.app),
    };
  }, [
    plugin.app,
    plugin.settings.discourseRelations,
    plugin.settings.nodeTypes,
    plugin.settings.relationTypes,
  ]);

  const selection = useSchemaSelection({
    source,
    resetKey: "export",
    initialTemplateNames: [...getReferencedTemplateNames(source.nodeTypes)],
  });

  const handleExport = async (): Promise<void> => {
    const payload = selection.asSelectionPayload();
    const hasSelection =
      payload.nodeTypeIds.length > 0 ||
      payload.relationTypeIds.length > 0 ||
      payload.relationIds.length > 0 ||
      payload.templateNames.length > 0;
    if (!hasSelection) {
      new Notice("Select at least one schema item or template to export.");
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportSchemaSelection({
        plugin,
        selection: {
          nodeTypeIds: payload.nodeTypeIds,
          relationTypeIds: payload.relationTypeIds,
          discourseRelationIds: payload.relationIds,
          templateNames: payload.templateNames,
        },
      });

      const warningSuffix =
        result.warnings.length > 0
          ? ` (${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"})`
          : "";

      new Notice(
        `Exported schema to ${result.filePath}${warningSuffix}.`,
        6000,
      );

      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          new Notice(warning, 6000);
        }
      }

      onClose();
    } catch (error) {
      if (error instanceof NativeFileDialogCancelledError) {
        return;
      }
      console.error("Failed to export schema:", error);
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Schema export failed: ${message}`, 6000);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SchemaSelectionModalBody
      title="Export discourse graph schema"
      description={`Select the node types, relation types, relation triples, and templates to include in ${outputFileName}.`}
      source={source}
      selection={selection}
      emptyTemplateText="No templates found in your Templates folder."
      onDependencyViolation={(message) => new Notice(message)}
      footerSecondaryLabel="Cancel"
      onFooterSecondaryClick={onClose}
      footerPrimaryLabel={isExporting ? "Exporting..." : "Export schema"}
      onFooterPrimaryClick={() => void handleExport()}
      isFooterPrimaryDisabled={isExporting}
    />
  );
};

export class ExportSpecsModal extends ReactRootModal {
  private plugin: DiscourseGraphPlugin;

  constructor(app: App, plugin: DiscourseGraphPlugin) {
    super(app);
    this.plugin = plugin;
  }

  protected renderContent() {
    return (
      <ExportSpecsContent plugin={this.plugin} onClose={() => this.close()} />
    );
  }
}
