import { App, TFile, TFolder } from "obsidian";

export const getTemplateFiles = async (app: App): Promise<string[]> => {
  try {
    const templatesPlugin = (app as any).internalPlugins?.plugins?.templates;
    if (!templatesPlugin || !templatesPlugin.enabled) {
      return [];
    }
    const templateFolderPath = templatesPlugin.instance?.options?.folder || "";
    if (!templateFolderPath) {
      return [];
    }
    const templateFolder = app.vault.getAbstractFileByPath(templateFolderPath);

    if (!templateFolder || !(templateFolder instanceof TFolder)) {
      return [];
    }

    const templateFiles = templateFolder.children
      .filter(
        (file: any): file is TFile =>
          file instanceof TFile && file.extension === "md",
      )
      .map((file: TFile) => file.basename)
      .sort();

    return templateFiles;
  } catch (error) {
    console.error("Error getting template files:", error);
    return [];
  }
};
