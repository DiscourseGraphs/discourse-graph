import { App, TFile, TFolder } from "obsidian";

type TemplatePluginInfo = {
  isEnabled: boolean;
  folderPath: string;
};

const getTemplatePluginInfo = (app: App): TemplatePluginInfo => {
  try {
    const templatesPlugin = (app as any).internalPlugins?.plugins?.templates;

    if (!templatesPlugin || !templatesPlugin.enabled) {
      return { isEnabled: false, folderPath: "" };
    }

    const folderPath = templatesPlugin.instance?.options?.folder || "";

    return {
      isEnabled: true,
      folderPath,
    };
  } catch (error) {
    console.error("Error accessing Templates plugin:", error);
    return { isEnabled: false, folderPath: "" };
  }
};

export const getTemplateFiles = async (app: App): Promise<string[]> => {
  try {
    const { isEnabled, folderPath } = getTemplatePluginInfo(app);

    if (!isEnabled) {
      return [];
    }

    if (!folderPath) {
      return [];
    }

    const templateFolder = app.vault.getAbstractFileByPath(folderPath);

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

export const applyTemplate = async (
  app: App,
  targetFile: TFile,
  templateName: string,
): Promise<boolean> => {
  try {
    const { isEnabled, folderPath } = getTemplatePluginInfo(app);

    if (!isEnabled) {
      console.warn("Templates plugin is not enabled");
      return false;
    }

    if (!folderPath) {
      console.warn("Template folder is not configured");
      return false;
    }

    const templateFilePath = `${folderPath}/${templateName}.md`;
    const templateFile = app.vault.getAbstractFileByPath(templateFilePath);

    if (!templateFile || !(templateFile instanceof TFile)) {
      console.warn(`Template file not found: ${templateFilePath}`);
      return false;
    }

    const templateContent = await app.vault.read(templateFile);

    const currentContent = await app.vault.read(targetFile);

    const newContent = currentContent + templateContent;

    await app.vault.modify(targetFile, newContent);

    return true;
  } catch (error) {
    console.error("Error applying template:", error);
    return false;
  }
};
