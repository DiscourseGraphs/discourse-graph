import { App, Modal, Notice } from "obsidian";
import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type DiscourseGraphPlugin from "~/index";
import {
  exportSchemaSelectionToVault,
  ExportSaveCancelledError,
} from "~/utils/specExport";
import { getDgSchemaFileName } from "~/utils/specArchive";
import { getTemplateFiles } from "~/utils/templates";
import { SchemaSelectionPanel } from "~/components/SchemaSelectionPanel";

type ExportSpecsModalProps = {
  plugin: DiscourseGraphPlugin;
  onClose: () => void;
};

const getAllNodeTypeIds = (plugin: DiscourseGraphPlugin): string[] => {
  return plugin.settings.nodeTypes.map((nodeType) => nodeType.id);
};

const getAllRelationTypeIds = (plugin: DiscourseGraphPlugin): string[] => {
  return plugin.settings.relationTypes.map((relationType) => relationType.id);
};

const getAllRelationIds = (plugin: DiscourseGraphPlugin): string[] => {
  return plugin.settings.discourseRelations.map((relation) => relation.id);
};

const getReferencedTemplateNames = (
  nodeTypes: DiscourseGraphPlugin["settings"]["nodeTypes"],
): Set<string> => {
  return new Set(
    nodeTypes
      .map((nodeType) => nodeType.template)
      .filter((template): template is string => !!template),
  );
};

export const openExportSpecsModal = (plugin: DiscourseGraphPlugin): void => {
  new ExportSpecsModal(plugin.app, plugin).open();
};

const ExportSpecsContent = ({ plugin, onClose }: ExportSpecsModalProps) => {
  const [selectedNodeTypeIds, setSelectedNodeTypeIds] = useState<Set<string>>(
    () => new Set(getAllNodeTypeIds(plugin)),
  );
  const [selectedRelationTypeIds, setSelectedRelationTypeIds] = useState<
    Set<string>
  >(() => new Set(getAllRelationTypeIds(plugin)));
  const [selectedRelationIds, setSelectedRelationIds] = useState<Set<string>>(
    () => new Set(getAllRelationIds(plugin)),
  );
  const [selectedTemplateNames, setSelectedTemplateNames] = useState<
    Set<string>
  >(() => getReferencedTemplateNames(plugin.settings.nodeTypes));
  const [isExporting, setIsExporting] = useState(false);
  const outputFileName = getDgSchemaFileName(plugin.app.vault.getName());

  const templateNames = useMemo(() => {
    return getTemplateFiles(plugin.app);
  }, [plugin.app]);

  const requiredRelationTypeIds = useMemo(() => {
    const requiredIds = new Set<string>();
    for (const relation of plugin.settings.discourseRelations) {
      if (selectedRelationIds.has(relation.id)) {
        requiredIds.add(relation.relationshipTypeId);
      }
    }
    return requiredIds;
  }, [plugin.settings.discourseRelations, selectedRelationIds]);

  const requiredNodeTypeIds = useMemo(() => {
    const requiredIds = new Set<string>();
    for (const relation of plugin.settings.discourseRelations) {
      if (!selectedRelationIds.has(relation.id)) continue;
      requiredIds.add(relation.sourceId);
      requiredIds.add(relation.destinationId);
    }
    return requiredIds;
  }, [plugin.settings.discourseRelations, selectedRelationIds]);

  useEffect(() => {
    setSelectedRelationTypeIds((previousSet) => {
      const nextSet = new Set(previousSet);
      let didChange = false;
      for (const relationTypeId of requiredRelationTypeIds) {
        if (!nextSet.has(relationTypeId)) {
          nextSet.add(relationTypeId);
          didChange = true;
        }
      }
      return didChange ? nextSet : previousSet;
    });
  }, [requiredRelationTypeIds]);

  useEffect(() => {
    setSelectedNodeTypeIds((previousSet) => {
      const nextSet = new Set(previousSet);
      let didChange = false;
      for (const nodeTypeId of requiredNodeTypeIds) {
        if (!nextSet.has(nodeTypeId)) {
          nextSet.add(nodeTypeId);
          didChange = true;
        }
      }
      return didChange ? nextSet : previousSet;
    });
  }, [requiredNodeTypeIds]);

  const updateSet = (
    previousSet: Set<string>,
    id: string,
    shouldSelect: boolean,
  ): Set<string> => {
    const nextSet = new Set(previousSet);
    if (shouldSelect) {
      nextSet.add(id);
    } else {
      nextSet.delete(id);
    }
    return nextSet;
  };

  const toggleNodeType = (nodeTypeId: string, shouldSelect: boolean): void => {
    if (!shouldSelect && requiredNodeTypeIds.has(nodeTypeId)) {
      new Notice(
        "This node type is required by a selected relation triple. Remove the triple first.",
      );
      return;
    }
    setSelectedNodeTypeIds((previousSet) =>
      updateSet(previousSet, nodeTypeId, shouldSelect),
    );
  };

  const toggleRelationType = (
    relationTypeId: string,
    shouldSelect: boolean,
  ): void => {
    if (!shouldSelect && requiredRelationTypeIds.has(relationTypeId)) {
      new Notice(
        "This relation type is required by a selected relation triple. Remove the triple first.",
      );
      return;
    }
    setSelectedRelationTypeIds((previousSet) =>
      updateSet(previousSet, relationTypeId, shouldSelect),
    );
  };

  const toggleRelationTriple = (
    relationId: string,
    shouldSelect: boolean,
  ): void => {
    setSelectedRelationIds((previousSet) =>
      updateSet(previousSet, relationId, shouldSelect),
    );
  };

  const toggleTemplate = (
    templateName: string,
    shouldSelect: boolean,
  ): void => {
    setSelectedTemplateNames((previousSet) =>
      updateSet(previousSet, templateName, shouldSelect),
    );
  };

  const handleExport = async (): Promise<void> => {
    const hasSelection =
      selectedNodeTypeIds.size > 0 ||
      selectedRelationTypeIds.size > 0 ||
      selectedRelationIds.size > 0 ||
      selectedTemplateNames.size > 0;
    if (!hasSelection) {
      new Notice("Select at least one schema item or template to export.");
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportSchemaSelectionToVault({
        plugin,
        selection: {
          nodeTypeIds: [...selectedNodeTypeIds],
          relationTypeIds: [...selectedRelationTypeIds],
          discourseRelationIds: [...selectedRelationIds],
          templateNames: [...selectedTemplateNames],
        },
      });

      const autoIncludedCount =
        result.dependencySummary.autoIncludedNodeTypeIds.length +
        result.dependencySummary.autoIncludedRelationTypeIds.length;
      const warningSuffix =
        result.warnings.length > 0
          ? ` (${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"})`
          : "";

      new Notice(
        `Exported schema to ${result.filePath}${warningSuffix}${
          autoIncludedCount > 0
            ? ` with ${autoIncludedCount} auto-included dependency item(s).`
            : "."
        }`,
        6000,
      );

      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          new Notice(warning, 6000);
        }
      }

      onClose();
    } catch (error) {
      if (error instanceof ExportSaveCancelledError) {
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
    <div>
      <h3 className="mb-2">Export discourse graph schema</h3>
      <p className="text-muted mb-4 text-sm">
        Select the node types, relation types, relation triples, and templates
        to include in <strong>{outputFileName}</strong>.
      </p>

      <SchemaSelectionPanel
        nodeTypes={plugin.settings.nodeTypes}
        relationTypes={plugin.settings.relationTypes}
        relationTriples={plugin.settings.discourseRelations}
        templateNames={templateNames}
        selectedNodeTypeIds={selectedNodeTypeIds}
        selectedRelationTypeIds={selectedRelationTypeIds}
        selectedRelationIds={selectedRelationIds}
        selectedTemplateNames={selectedTemplateNames}
        requiredNodeTypeIds={requiredNodeTypeIds}
        requiredRelationTypeIds={requiredRelationTypeIds}
        onSelectAllNodeTypes={() =>
          setSelectedNodeTypeIds(new Set(getAllNodeTypeIds(plugin)))
        }
        onDeselectOptionalNodeTypes={() =>
          setSelectedNodeTypeIds(new Set([...requiredNodeTypeIds]))
        }
        onToggleNodeType={toggleNodeType}
        onSelectAllRelationTypes={() =>
          setSelectedRelationTypeIds(new Set(getAllRelationTypeIds(plugin)))
        }
        onDeselectOptionalRelationTypes={() =>
          setSelectedRelationTypeIds(new Set([...requiredRelationTypeIds]))
        }
        onToggleRelationType={toggleRelationType}
        onSelectAllRelationTriples={() =>
          setSelectedRelationIds(new Set(getAllRelationIds(plugin)))
        }
        onDeselectAllRelationTriples={() => setSelectedRelationIds(new Set())}
        onToggleRelationTriple={toggleRelationTriple}
        onSelectAllTemplates={() =>
          setSelectedTemplateNames(new Set(templateNames))
        }
        onDeselectAllTemplates={() => setSelectedTemplateNames(new Set())}
        onToggleTemplate={toggleTemplate}
        emptyTemplateText="No templates found in your Templates folder."
      />

      <div className="mt-6 flex justify-between">
        <button type="button" onClick={onClose} className="px-4 py-2">
          Cancel
        </button>
        <button
          type="button"
          className="!bg-accent !text-on-accent rounded px-4 py-2"
          onClick={() => void handleExport()}
          disabled={isExporting}
        >
          {isExporting ? "Exporting..." : "Export schema"}
        </button>
      </div>
    </div>
  );
};

export class ExportSpecsModal extends Modal {
  private plugin: DiscourseGraphPlugin;
  private root: Root | null = null;

  constructor(app: App, plugin: DiscourseGraphPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.root = createRoot(contentEl);
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
