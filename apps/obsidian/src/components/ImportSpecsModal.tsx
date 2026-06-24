import { App, Modal, Notice } from "obsidian";
import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type DiscourseGraphPlugin from "~/index";
import {
  applySchemaImportSelection,
  ImportFileSelectionCancelledError,
  pickAndPreviewSchemaImport,
  type SpecImportSelection,
  type SpecImportPreview,
} from "~/utils/specImport";
import { SchemaSelectionPanel } from "~/components/SchemaSelectionPanel";

type ImportSpecsModalProps = {
  plugin: DiscourseGraphPlugin;
  onClose: () => void;
};

const getNodeTypeIdsFromPreview = (preview: SpecImportPreview): string[] => {
  return preview.archive.nodeTypes.map((nodeType) => nodeType.id);
};

const getRelationTypeIdsFromPreview = (
  preview: SpecImportPreview,
): string[] => {
  return preview.archive.relationTypes.map((relationType) => relationType.id);
};

const getRelationIdsFromPreview = (preview: SpecImportPreview): string[] => {
  return preview.archive.discourseRelations.map((relation) => relation.id);
};

const getTemplateNamesFromPreview = (preview: SpecImportPreview): string[] => {
  return preview.archive.templates.map((template) => template.name);
};

export const openImportSpecsModal = (plugin: DiscourseGraphPlugin): void => {
  new ImportSpecsModal(plugin.app, plugin).open();
};

const ImportSpecsContent = ({ plugin, onClose }: ImportSpecsModalProps) => {
  const [preview, setPreview] = useState<SpecImportPreview | null>(null);
  const [isSelectingFile, setIsSelectingFile] = useState(false);
  const [selectedNodeTypeIds, setSelectedNodeTypeIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedRelationTypeIds, setSelectedRelationTypeIds] = useState<
    Set<string>
  >(new Set());
  const [selectedRelationIds, setSelectedRelationIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedTemplateNames, setSelectedTemplateNames] = useState<
    Set<string>
  >(new Set());
  const [isApplyingImport, setIsApplyingImport] = useState(false);

  useEffect(() => {
    if (!preview) {
      setSelectedNodeTypeIds(new Set());
      setSelectedRelationTypeIds(new Set());
      setSelectedRelationIds(new Set());
      setSelectedTemplateNames(new Set());
      return;
    }
    setSelectedNodeTypeIds(new Set(getNodeTypeIdsFromPreview(preview)));
    setSelectedRelationTypeIds(new Set(getRelationTypeIdsFromPreview(preview)));
    setSelectedRelationIds(new Set(getRelationIdsFromPreview(preview)));
    setSelectedTemplateNames(new Set(getTemplateNamesFromPreview(preview)));
  }, [preview]);

  const requiredRelationTypeIds = useMemo(() => {
    if (!preview) return new Set<string>();
    const required = new Set<string>();
    for (const relation of preview.archive.discourseRelations) {
      if (selectedRelationIds.has(relation.id)) {
        required.add(relation.relationshipTypeId);
      }
    }
    return required;
  }, [preview, selectedRelationIds]);

  const requiredNodeTypeIds = useMemo(() => {
    if (!preview) return new Set<string>();
    const required = new Set<string>();
    for (const relation of preview.archive.discourseRelations) {
      if (!selectedRelationIds.has(relation.id)) continue;
      required.add(relation.sourceId);
      required.add(relation.destinationId);
    }
    return required;
  }, [preview, selectedRelationIds]);

  useEffect(() => {
    if (!preview) return;
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
  }, [preview, requiredRelationTypeIds]);

  useEffect(() => {
    if (!preview) return;
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
  }, [preview, requiredNodeTypeIds]);

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

  const buildSelection = (): SpecImportSelection => {
    return {
      nodeTypeIds: [...selectedNodeTypeIds],
      relationTypeIds: [...selectedRelationTypeIds],
      discourseRelationIds: [...selectedRelationIds],
      templateNames: [...selectedTemplateNames],
    };
  };

  const handleApplyImport = async (): Promise<void> => {
    if (!preview) {
      return;
    }
    const selection = buildSelection();
    const hasAnySelection =
      selection.nodeTypeIds.length > 0 ||
      selection.relationTypeIds.length > 0 ||
      selection.discourseRelationIds.length > 0 ||
      selection.templateNames.length > 0;
    if (!hasAnySelection) {
      new Notice("Select at least one item to import.");
      return;
    }

    setIsApplyingImport(true);
    try {
      const result = await applySchemaImportSelection({
        plugin,
        preview,
        selection,
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

  if (!preview) {
    return (
      <div>
        <h3 className="mb-2">Import discourse graph schema</h3>
        <p className="text-muted mb-4 text-sm">
          Pick a <code>dg-schema-*.json</code> file from your computer to
          preview and choose exactly what to import.
        </p>

        <div className="mb-4 rounded border p-3 text-sm">
          This slice is preview + selection only. Apply import writes are next.
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
    <div>
      <h3 className="mb-2">Import schema preview</h3>
      <p className="text-muted mb-2 text-sm">
        Source file: <span className="font-medium">{preview.sourcePath}</span>
      </p>
      <p className="text-muted mb-4 text-sm">
        Same dependency rules as export: selected relation triples require their
        relation type and endpoint node types.
      </p>

      <div className="mb-4 rounded border p-3 text-sm">
        <div className="font-medium">Archive metadata</div>
        <div className="text-muted mt-1">
          Vault:{" "}
          <span className="font-medium">{preview.archive.vaultName}</span>
        </div>
        <div className="text-muted">
          Exported at:{" "}
          <span className="font-medium">{preview.archive.exportedAt}</span>
        </div>
        <div className="text-muted">
          Plugin version:{" "}
          <span className="font-medium">{preview.archive.pluginVersion}</span>
        </div>
      </div>

      <SchemaSelectionPanel
        nodeTypes={preview.archive.nodeTypes}
        relationTypes={preview.archive.relationTypes}
        relationTriples={preview.archive.discourseRelations}
        templateNames={preview.archive.templates.map(
          (template) => template.name,
        )}
        selectedNodeTypeIds={selectedNodeTypeIds}
        selectedRelationTypeIds={selectedRelationTypeIds}
        selectedRelationIds={selectedRelationIds}
        selectedTemplateNames={selectedTemplateNames}
        requiredNodeTypeIds={requiredNodeTypeIds}
        requiredRelationTypeIds={requiredRelationTypeIds}
        onSelectAllNodeTypes={() =>
          setSelectedNodeTypeIds(new Set(getNodeTypeIdsFromPreview(preview)))
        }
        onDeselectOptionalNodeTypes={() =>
          setSelectedNodeTypeIds(new Set([...requiredNodeTypeIds]))
        }
        onToggleNodeType={(nodeTypeId, shouldSelect) => {
          if (!shouldSelect && requiredNodeTypeIds.has(nodeTypeId)) {
            new Notice(
              "This node type is required by a selected relation triple. Remove the triple first.",
            );
            return;
          }
          setSelectedNodeTypeIds((previousSet) =>
            updateSet(previousSet, nodeTypeId, shouldSelect),
          );
        }}
        onSelectAllRelationTypes={() =>
          setSelectedRelationTypeIds(
            new Set(getRelationTypeIdsFromPreview(preview)),
          )
        }
        onDeselectOptionalRelationTypes={() =>
          setSelectedRelationTypeIds(new Set([...requiredRelationTypeIds]))
        }
        onToggleRelationType={(relationTypeId, shouldSelect) => {
          if (!shouldSelect && requiredRelationTypeIds.has(relationTypeId)) {
            new Notice(
              "This relation type is required by a selected relation triple. Remove the triple first.",
            );
            return;
          }
          setSelectedRelationTypeIds((previousSet) =>
            updateSet(previousSet, relationTypeId, shouldSelect),
          );
        }}
        onSelectAllRelationTriples={() =>
          setSelectedRelationIds(new Set(getRelationIdsFromPreview(preview)))
        }
        onDeselectAllRelationTriples={() => setSelectedRelationIds(new Set())}
        onToggleRelationTriple={(relationId, shouldSelect) =>
          setSelectedRelationIds((previousSet) =>
            updateSet(previousSet, relationId, shouldSelect),
          )
        }
        onSelectAllTemplates={() =>
          setSelectedTemplateNames(
            new Set(getTemplateNamesFromPreview(preview)),
          )
        }
        onDeselectAllTemplates={() => setSelectedTemplateNames(new Set())}
        onToggleTemplate={(templateName, shouldSelect) =>
          setSelectedTemplateNames((previousSet) =>
            updateSet(previousSet, templateName, shouldSelect),
          )
        }
        emptyTemplateText="No templates found in this schema file."
      />

      <div className="mt-4 rounded border p-3 text-sm">
        <div className="font-medium">Current preview stats (full archive)</div>
        <div className="text-muted mt-1">
          Node types: {preview.nodeTypes.total} total (
          {preview.nodeTypes.newCount} new, {preview.nodeTypes.matchedById} ID
          matches, {preview.nodeTypes.matchedByName} name matches)
        </div>
        <div className="text-muted">
          Relation types: {preview.relationTypes.total} total (
          {preview.relationTypes.newCount} new,{" "}
          {preview.relationTypes.matchedById} ID matches,{" "}
          {preview.relationTypes.matchedByLabel} label matches)
        </div>
        <div className="text-muted">
          Relation triples: {preview.discourseRelations.total} total (
          {preview.discourseRelations.newCount} new,{" "}
          {preview.discourseRelations.existingCount} existing)
        </div>
        <div className="text-muted">
          Templates: {preview.templates.total} total (
          {preview.templates.newCount} new, {preview.templates.existingCount}{" "}
          existing)
        </div>
      </div>

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          className="px-4 py-2"
          onClick={() => setPreview(null)}
          disabled={isSelectingFile || isApplyingImport}
        >
          Choose another file
        </button>
        <button
          type="button"
          className="!bg-accent !text-on-accent rounded px-4 py-2"
          onClick={() => void handleApplyImport()}
          disabled={isApplyingImport}
        >
          {isApplyingImport ? "Importing..." : "Import selected"}
        </button>
      </div>
    </div>
  );
};

export class ImportSpecsModal extends Modal {
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
