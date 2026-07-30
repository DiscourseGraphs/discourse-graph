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
import { getVaultId } from "~/utils/supabaseContext";

const getTemplateContents = async ({
  plugin,
  templateNames,
  onWarning,
}: {
  plugin: DiscourseGraphPlugin;
  templateNames: string[];
  onWarning: (message: string) => void;
}): Promise<DiscourseSchemaTemplate[]> => {
  const { isEnabled, folderPath } = getTemplatePluginInfo(plugin.app);

  if (!isEnabled || !folderPath) {
    if (templateNames.length > 0) {
      onWarning(
        "Templates plugin is not enabled or folder is not configured; template content was skipped.",
      );
    }
    return [];
  }

  const templates: DiscourseSchemaTemplate[] = [];
  for (const templateName of templateNames) {
    const templatePath = `${folderPath}/${templateName}.md`;
    const templateFile = plugin.app.vault.getAbstractFileByPath(templatePath);

    if (!(templateFile instanceof TFile)) {
      onWarning(`Template file not found: ${templateName}.md`);
      continue;
    }

    const content = await plugin.app.vault.read(templateFile);
    templates.push({ name: templateName, content });
  }

  return templates;
};

export const exportSchemaSelection = async ({
  plugin,
  selection,
  onWarning = () => {},
}: {
  plugin: DiscourseGraphPlugin;
  selection: SchemaSelection;
  onWarning?: (message: string) => void;
}): Promise<string> => {
  const selectedNodeTypeIds = new Set(selection.nodeTypeIds);
  const selectedRelationTypeIds = new Set(selection.relationTypeIds);
  const selectedDiscourseRelationIds = new Set(selection.discourseRelationIds);

  const templates = await getTemplateContents({
    plugin,
    templateNames: selection.templateNames,
    onWarning,
  });

  const payload: DiscourseSchemaFile = {
    version: DG_SCHEMA_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    pluginVersion: plugin.manifest.version,
    vaultName: plugin.app.vault.getName(),
    vaultId: getVaultId(plugin.app),
    nodeTypes: plugin.settings.nodeTypes.filter((nt) =>
      selectedNodeTypeIds.has(nt.id),
    ),
    relationTypes: plugin.settings.relationTypes.filter((rt) =>
      selectedRelationTypeIds.has(rt.id),
    ),
    discourseRelations: plugin.settings.discourseRelations.filter((dr) =>
      selectedDiscourseRelationIds.has(dr.id),
    ),
    templates,
  };

  const serializedPayload = JSON.stringify(payload, null, 2);
  const fileName = getDgSchemaFileName(plugin.app.vault.getName());
  return saveJsonToUserLocation({
    title: "Export discourse graph schema",
    fileName,
    content: serializedPayload,
  });
};
