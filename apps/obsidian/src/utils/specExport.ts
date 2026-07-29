import { TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type {
  DiscourseNode,
  DiscourseRelation,
  DiscourseSchemaFile,
  DiscourseSchemaTemplate,
} from "~/types";
import {
  DG_SCHEMA_EXPORT_VERSION,
  getDgSchemaFileName,
} from "~/utils/specValidation";
import { getTemplatePluginInfo } from "~/utils/templates";
import { saveJsonToUserLocation } from "~/utils/nativeJsonFileDialogs";

export type SpecExportSelection = {
  nodeTypeIds: string[];
  relationTypeIds: string[];
  discourseRelationIds: string[];
  templateNames: string[];
};

export type SpecExportResult = {
  filePath: string;
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
}): Promise<{ templates: DiscourseSchemaTemplate[]; warnings: string[] }> => {
  const warnings: string[] = [];
  const templates: DiscourseSchemaTemplate[] = [];
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

const buildSchemaExportPayload = async ({
  plugin,
  selection,
}: {
  plugin: DiscourseGraphPlugin;
  selection: SpecExportSelection;
}): Promise<{ payload: DiscourseSchemaFile; warnings: string[] }> => {
  const nodeTypeMap = asMap(plugin.settings.nodeTypes);
  const relationTypeMap = asMap(plugin.settings.relationTypes);
  const discourseRelationMap = asMap(plugin.settings.discourseRelations);

  const selectedNodeTypes: DiscourseNode[] = selection.nodeTypeIds
    .map((id) => nodeTypeMap.get(id))
    .filter((nodeType): nodeType is DiscourseNode => !!nodeType);

  const selectedRelationTypes = selection.relationTypeIds
    .map((id) => relationTypeMap.get(id))
    .filter((relationType) => !!relationType);

  const selectedDiscourseRelations: DiscourseRelation[] =
    selection.discourseRelationIds
      .map((id) => discourseRelationMap.get(id))
      .filter((relation): relation is DiscourseRelation => !!relation);

  const { templates, warnings } = await getTemplateContents({
    plugin,
    templateNames: selection.templateNames,
  });

  const payload: DiscourseSchemaFile = {
    version: DG_SCHEMA_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    pluginVersion: plugin.manifest.version,
    vaultName: plugin.app.vault.getName(),
    nodeTypes: selectedNodeTypes,
    relationTypes: selectedRelationTypes,
    discourseRelations: selectedDiscourseRelations,
    templates,
  };

  return { payload, warnings };
};

export const exportSchemaSelection = async ({
  plugin,
  selection,
}: {
  plugin: DiscourseGraphPlugin;
  selection: SpecExportSelection;
}): Promise<SpecExportResult> => {
  const { payload, warnings } = await buildSchemaExportPayload({
    plugin,
    selection,
  });
  const serializedPayload = JSON.stringify(payload, null, 2);
  const fileName = getDgSchemaFileName(plugin.app.vault.getName());
  const filePath = await saveJsonToUserLocation({
    title: "Export discourse graph schema",
    fileName,
    content: serializedPayload,
  });

  return { filePath, warnings };
};
