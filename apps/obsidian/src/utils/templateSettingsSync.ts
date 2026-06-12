import { Notice, TAbstractFile, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { syncNodeTypeTemplatesOnTemplateFileChange } from "~/utils/templates";

const formatNodeTypeList = (nodeTypeNames: string[]): string => {
  if (nodeTypeNames.length === 1) {
    return nodeTypeNames[0] ?? "";
  }

  if (nodeTypeNames.length === 2) {
    return `${nodeTypeNames[0]} and ${nodeTypeNames[1]}`;
  }

  const lastNodeType = nodeTypeNames[nodeTypeNames.length - 1];
  return `${nodeTypeNames.slice(0, -1).join(", ")}, and ${lastNodeType}`;
};

const applyTemplateSettingsSync = async ({
  plugin,
  oldPath,
  newFile,
}: {
  plugin: DiscourseGraphPlugin;
  oldPath: string;
  newFile?: TFile;
}): Promise<void> => {
  const result = syncNodeTypeTemplatesOnTemplateFileChange({
    plugin,
    oldPath,
    newFile,
  });

  if (result.updatedNodeTypeNames.length === 0 || !result.action) {
    return;
  }

  await plugin.saveSettings();

  const nodeTypeList = formatNodeTypeList(result.updatedNodeTypeNames);
  const message =
    result.action === "updated"
      ? `Updated template for ${nodeTypeList}`
      : `Cleared template for ${nodeTypeList}`;

  new Notice(message, 3000);
};

const isMarkdownFile = (file: TAbstractFile): file is TFile => {
  return file instanceof TFile && file.extension === "md";
};

export const registerTemplateSettingsSync = (
  plugin: DiscourseGraphPlugin,
): void => {
  plugin.registerEvent(
    plugin.app.vault.on("rename", (file: TAbstractFile, oldPath: string) => {
      if (!isMarkdownFile(file)) {
        return;
      }

      void applyTemplateSettingsSync({
        plugin,
        oldPath,
        newFile: file,
      });
    }),
  );

  plugin.registerEvent(
    plugin.app.vault.on("delete", (file: TAbstractFile) => {
      if (!isMarkdownFile(file)) {
        return;
      }

      void applyTemplateSettingsSync({
        plugin,
        oldPath: file.path,
      });
    }),
  );
};
