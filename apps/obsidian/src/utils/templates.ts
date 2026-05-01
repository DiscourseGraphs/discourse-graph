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

type CreateTemplateFileResult =
  | { created: true }
  | { created: false; reason: string };

export const createTemplateFile = async ({
  app,
  templateName,
  content,
}: {
  app: App;
  templateName: string;
  content: string;
}): Promise<CreateTemplateFileResult> => {
  const { isEnabled, folderPath } = getTemplatePluginInfo(app);

  if (!isEnabled) {
    return { created: false, reason: "Templates plugin is not enabled" };
  }

  if (!folderPath) {
    return {
      created: false,
      reason: "Templates folder path is not configured",
    };
  }

  // Ensure every segment of the folder path exists, creating missing ones
  const segments = folderPath.split("/").filter(Boolean);
  let currentPath = "";
  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    const existing = app.vault.getAbstractFileByPath(currentPath);
    if (!existing) {
      await app.vault.createFolder(currentPath);
    }
  }

  const templateFilePath = `${folderPath}/${templateName}.md`;

  // Don't overwrite an existing template — the local file takes precedence
  const existingFile = app.vault.getAbstractFileByPath(templateFilePath);
  if (existingFile instanceof TFile) {
    return { created: false, reason: "template already exists" };
  }

  await app.vault.create(templateFilePath, content);
  return { created: true };
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
      return false;
    }

    if (!folderPath) {
      return false;
    }

    const templateFilePath = `${folderPath}/${templateName}.md`;
    const templateFile = app.vault.getAbstractFileByPath(templateFilePath);

    if (!templateFile || !(templateFile instanceof TFile)) {
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
