import {
  App,
  TFile,
  TFolder,
  TAbstractFile,
  getFrontMatterInfo,
} from "obsidian";

type TemplatePluginInfo = {
  isEnabled: boolean;
  folderPath: string;
};

const mergeFrontmatter = (
  template: Record<string, any>,
  current: Record<string, any>,
): Record<string, any> => {
  const result = { ...template };

  for (const [key, currentValue] of Object.entries(current)) {
    const templateValue = result[key];

    if (templateValue === undefined) {
      result[key] = currentValue;
    } else if (Array.isArray(templateValue) && Array.isArray(currentValue)) {
      const merged = [...templateValue, ...currentValue];
      result[key] = [...new Set(merged)];
    } else if (
      typeof templateValue === "object" &&
      templateValue !== null &&
      typeof currentValue === "object" &&
      currentValue !== null &&
      !Array.isArray(templateValue) &&
      !Array.isArray(currentValue)
    ) {
      // Both are objects, merge recursively
      result[key] = mergeFrontmatter(templateValue, currentValue);
    } else {
      // Current value takes precedence for primitives
      result[key] = currentValue;
    }
  }

  return result;
};

export const getTemplatePluginInfo = (app: App): TemplatePluginInfo => {
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

export const getTemplateFiles = (app: App): string[] => {
  try {
    const { isEnabled, folderPath } = getTemplatePluginInfo(app);

    if (!isEnabled || !folderPath) {
      return [];
    }

    const templateFolder = app.vault.getAbstractFileByPath(folderPath);

    if (!templateFolder || !(templateFolder instanceof TFolder)) {
      return [];
    }

    const templateFiles = templateFolder.children
      .filter(
        (file: TAbstractFile): file is TFile =>
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

export const applyTemplate = async ({
  app,
  targetFile,
  templateName,
}: {
  app: App;
  targetFile: TFile;
  templateName: string;
}): Promise<boolean> => {
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

    const templateFrontmatter =
      app.metadataCache.getFileCache(templateFile)?.frontmatter || {};
    const currentFrontmatter =
      app.metadataCache.getFileCache(targetFile)?.frontmatter || {};

    const mergedFrontmatter = mergeFrontmatter(
      templateFrontmatter,
      currentFrontmatter,
    );

    await app.fileManager.processFrontMatter(targetFile, (fm) => {
      Object.assign(fm, mergedFrontmatter);
    });

    const frontmatterInfo = getFrontMatterInfo(templateContent);
    const templateBody = frontmatterInfo.exists
      ? templateContent.slice(frontmatterInfo.contentStart)
      : templateContent;

    if (templateBody.trim()) {
      await app.vault.append(targetFile, templateBody);
    }

    return true;
  } catch (error) {
    console.error("Error applying template:", error);
    return false;
  }
};
