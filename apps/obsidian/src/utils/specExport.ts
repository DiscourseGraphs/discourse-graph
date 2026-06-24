import { TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type {
  DiscourseNode,
  DiscourseRelation,
  DiscourseRelationType,
} from "~/types";
import {
  DG_SCHEMA_EXPORT_VERSION,
  getDgSchemaFileName,
  parseDgSchemaFile,
  type DgSchemaFile,
  type TemplateExportRecord,
} from "~/utils/specValidation";
import { getTemplatePluginInfo } from "~/utils/templates";
import {
  NativeFileDialogCancelledError,
  saveJsonToUserLocation,
} from "~/utils/nativeJsonFileDialogs";

export type SpecExportSelection = {
  nodeTypeIds: string[];
  relationTypeIds: string[];
  discourseRelationIds: string[];
  templateNames: string[];
};

export type SpecExportDependencySummary = {
  autoIncludedNodeTypeIds: string[];
  autoIncludedRelationTypeIds: string[];
};

export type SpecExportResult = {
  filePath: string;
  payload: DgSchemaFile;
  dependencySummary: SpecExportDependencySummary;
  warnings: string[];
};

type BuildPayloadResult = {
  payload: DgSchemaFile;
  dependencySummary: SpecExportDependencySummary;
  warnings: string[];
};

const asMap = <T extends { id: string }>(items: T[]): Map<string, T> => {
  return new Map(items.map((item) => [item.id, item]));
};

const getTemplateContents = async ({
  plugin,
  templateNames,
}: {
  plugin: DiscourseGraphPlugin;
  templateNames: string[];
}): Promise<{ templates: TemplateExportRecord[]; warnings: string[] }> => {
  const warnings: string[] = [];
  const templates: TemplateExportRecord[] = [];
  const { isEnabled, folderPath } = getTemplatePluginInfo(plugin.app);

  if (!isEnabled || !folderPath) {
    if (templateNames.length > 0) {
      warnings.push(
        "Templates plugin is not enabled or folder is not configured; template content was skipped.",
      );
    }
    return { templates, warnings };
  }

  for (const templateName of templateNames) {
    const templatePath = `${folderPath}/${templateName}.md`;
    const templateFile = plugin.app.vault.getAbstractFileByPath(templatePath);

    if (!(templateFile instanceof TFile)) {
      warnings.push(`Template file not found: ${templateName}.md`);
      continue;
    }

    const content = await plugin.app.vault.read(templateFile);
    templates.push({ name: templateName, content });
  }

  return { templates, warnings };
};

export const buildSchemaExportPayload = async ({
  plugin,
  selection,
}: {
  plugin: DiscourseGraphPlugin;
  selection: SpecExportSelection;
}): Promise<BuildPayloadResult> => {
  const nodeTypeMap = asMap(plugin.settings.nodeTypes);
  const relationTypeMap = asMap(plugin.settings.relationTypes);
  const discourseRelationMap = asMap(plugin.settings.discourseRelations);

  const selectedDiscourseRelations: DiscourseRelation[] =
    selection.discourseRelationIds
      .map((id) => discourseRelationMap.get(id))
      .filter((relation): relation is DiscourseRelation => !!relation);

  const dependencyRelationTypeIds = new Set<string>();
  const dependencyNodeTypeIds = new Set<string>();

  for (const relation of selectedDiscourseRelations) {
    dependencyRelationTypeIds.add(relation.relationshipTypeId);
    dependencyNodeTypeIds.add(relation.sourceId);
    dependencyNodeTypeIds.add(relation.destinationId);
  }

  const selectedRelationTypeIds = new Set(selection.relationTypeIds);
  for (const relationTypeId of dependencyRelationTypeIds) {
    selectedRelationTypeIds.add(relationTypeId);
  }

  const selectedNodeTypeIds = new Set(selection.nodeTypeIds);
  for (const nodeTypeId of dependencyNodeTypeIds) {
    selectedNodeTypeIds.add(nodeTypeId);
  }

  const selectedNodeTypes: DiscourseNode[] = [...selectedNodeTypeIds]
    .map((id) => nodeTypeMap.get(id))
    .filter((nodeType): nodeType is DiscourseNode => !!nodeType);

  const selectedRelationTypes: DiscourseRelationType[] = [
    ...selectedRelationTypeIds,
  ]
    .map((id) => relationTypeMap.get(id))
    .filter(
      (relationType): relationType is DiscourseRelationType => !!relationType,
    );

  const { templates, warnings } = await getTemplateContents({
    plugin,
    templateNames: selection.templateNames,
  });

  const payload = parseDgSchemaFile({
    version: DG_SCHEMA_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    pluginVersion: plugin.manifest.version,
    vaultName: plugin.app.vault.getName(),
    nodeTypes: selectedNodeTypes,
    relationTypes: selectedRelationTypes,
    discourseRelations: selectedDiscourseRelations,
    templates,
  });

  return {
    payload,
    dependencySummary: {
      autoIncludedNodeTypeIds: [...dependencyNodeTypeIds].filter(
        (id) => !selection.nodeTypeIds.includes(id),
      ),
      autoIncludedRelationTypeIds: [...dependencyRelationTypeIds].filter(
        (id) => !selection.relationTypeIds.includes(id),
      ),
    },
    warnings,
  };
};

const saveSchemaExportFile = async ({
  fileName,
  content,
}: {
  fileName: string;
  content: string;
}): Promise<string> => {
  return saveJsonToUserLocation({
    title: "Export discourse graph schema",
    fileName,
    content,
  });
};

export const exportSchemaSelectionToVault = async ({
  plugin,
  selection,
}: {
  plugin: DiscourseGraphPlugin;
  selection: SpecExportSelection;
}): Promise<SpecExportResult> => {
  const { payload, dependencySummary, warnings } =
    await buildSchemaExportPayload({
      plugin,
      selection,
    });
  const serializedPayload = JSON.stringify(payload, null, 2);
  const fileName = getDgSchemaFileName(plugin.app.vault.getName());
  const filePath = await saveSchemaExportFile({
    fileName,
    content: serializedPayload,
  });

  return {
    filePath,
    payload,
    dependencySummary,
    warnings,
  };
};

export { NativeFileDialogCancelledError as ExportSaveCancelledError };
