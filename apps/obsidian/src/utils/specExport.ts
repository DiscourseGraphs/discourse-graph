import { TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type {
  DiscourseSchemaFile,
  DiscourseSchemaTemplate,
  SchemaSelection,
} from "~/types";
import {
  DG_SCHEMA_EXPORT_VERSION,
  getDgSchemaFileName,
} from "~/utils/specValidation";
import { getTemplatePluginInfo } from "~/utils/templates";
import { saveJsonToUserLocation } from "~/utils/nativeJsonFileDialogs";

export type SpecExportResult = {
  filePath: string;
  warnings: string[];
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
  selection: SchemaSelection;
}): Promise<{ payload: DiscourseSchemaFile; warnings: string[] }> => {
  const selectedNodeTypeIds = new Set(selection.nodeTypeIds);
  const selectedRelationTypeIds = new Set(selection.relationTypeIds);
  const selectedDiscourseRelationIds = new Set(selection.discourseRelationIds);

  const selectedNodeTypes = plugin.settings.nodeTypes.filter((nt) =>
    selectedNodeTypeIds.has(nt.id),
  );
  const selectedRelationTypes = plugin.settings.relationTypes.filter((rt) =>
    selectedRelationTypeIds.has(rt.id),
  );
  const selectedDiscourseRelations = plugin.settings.discourseRelations.filter(
    (dr) => selectedDiscourseRelationIds.has(dr.id),
  );

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
  selection: SchemaSelection;
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
