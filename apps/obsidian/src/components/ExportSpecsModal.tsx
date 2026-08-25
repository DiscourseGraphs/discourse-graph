import { Modal, Notice } from "obsidian";
import { StrictMode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type DiscourseGraphPlugin from "~/index";
import { exportSchemaSelection } from "~/utils/specExport";
import { NativeFileDialogCancelledError } from "~/utils/nativeJsonFileDialogs";
import { getDgSchemaFileName } from "~/utils/specValidation";
import { getTemplateFiles } from "~/utils/templates";
import {
  getReferencedTemplateNames,
  useSchemaSelection,
} from "~/components/useSchemaSelection";
import { SchemaSelectionModalBody } from "~/components/SchemaSelectionModalBody";

type ExportSpecsModalProps = {
  plugin: DiscourseGraphPlugin;
  onClose: () => void;
};

export const openExportSpecsModal = (plugin: DiscourseGraphPlugin): void => {
  new ExportSpecsModal(plugin).open();
};

const ExportSpecsContent = ({ plugin, onClose }: ExportSpecsModalProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const outputFileName = getDgSchemaFileName(plugin.app.vault.getName());

  const source = {
    nodeTypes: plugin.settings.nodeTypes,
    relationTypes: plugin.settings.relationTypes,
    relationTriples: plugin.settings.discourseRelations,
    templateNames: getTemplateFiles(plugin.app),
  };

  const selection = useSchemaSelection({
    source,
    resetKey: "export",
    initialTemplateNames: [
      ...getReferencedTemplateNames(source.nodeTypes),
    ].filter((name) => source.templateNames.includes(name)),
  });

  const handleExport = async (): Promise<void> => {
    const payload = selection.asSelectionPayload();
    const hasSelection =
      payload.nodeTypeIds.length > 0 ||
      payload.relationTypeIds.length > 0 ||
      payload.discourseRelationIds.length > 0 ||
      payload.templateNames.length > 0;
    if (!hasSelection) {
      new Notice("Select at least one schema item or template to export.");
      return;
    }

    setIsExporting(true);
    const warnings: string[] = [];
    try {
      const filePath = await exportSchemaSelection({
        plugin,
        selection: payload,
        onWarning: (message) => warnings.push(message),
      });

      new Notice(`Exported schema to ${filePath}.`, 6000);
      if (warnings.length > 0) {
        new Notice(`Export warnings:\n${warnings.join("\n")}`, 6000);
      }

      onClose();
    } catch (error) {
      if (error instanceof NativeFileDialogCancelledError) {
        return;
      }
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
      footerSecondaryLabel="Cancel"
      onFooterSecondaryClick={onClose}
      footerPrimaryLabel={isExporting ? "Exporting..." : "Export schema"}
      onFooterPrimaryClick={() => void handleExport()}
      isFooterPrimaryDisabled={isExporting}
    />
  );
};

export class ExportSpecsModal extends Modal {
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
        <ExportSpecsContent plugin={this.plugin} onClose={() => this.close()} />
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
