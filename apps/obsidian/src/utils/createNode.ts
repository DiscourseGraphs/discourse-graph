import { App, Editor, Notice, TFile } from "obsidian";
import { DiscourseNode } from "~/types";
import { getDiscourseNodeFormatExpression } from "./getDiscourseNodeFormatExpression";
import { checkInvalidChars } from "./validateNodeType";
import { applyTemplate } from "./templates";
import type DiscourseGraphPlugin from "~/index";

export const formatNodeName = (
  text: string,
  nodeType: DiscourseNode,
): string | null => {
  const normalizedText = text.replace(/\s*\n\s*/g, " ").trim();

  const regex = getDiscourseNodeFormatExpression(nodeType.format);
  const nodeFormat = regex.source.match(/^\^(.*?)\(\.\*\?\)(.*?)\$$/);

  if (!nodeFormat) return null;

  return (
    nodeFormat[1]?.replace(/\\/g, "") +
    normalizedText +
    nodeFormat[2]?.replace(/\\/g, "")
  );
};

export const createDiscourseNodeFile = async ({
  plugin,
  formattedNodeName,
  nodeType,
}: {
  plugin: DiscourseGraphPlugin;
  formattedNodeName: string;
  nodeType: DiscourseNode;
}): Promise<TFile | null> => {
  try {
    const { app, settings } = plugin;

    const fileName = `${formattedNodeName}.md`;

    const existingFile = app.metadataCache.getFirstLinkpathDest(
      formattedNodeName,
      "",
    );

    if (existingFile) {
      new Notice(
        `File ${formattedNodeName} already exists at ${existingFile.path}`,
        3000,
      );
      return existingFile;
    }

    const folderPath = settings.nodesFolderPath.trim();
    const fullPath = folderPath ? `${folderPath}/${fileName}` : fileName;

    if (folderPath) {
      const folderExists = app.vault.getAbstractFileByPath(folderPath);
      if (!folderExists) {
        await app.vault.createFolder(folderPath);
      }
    }

    const newFile = await app.vault.create(fullPath, "");
    await app.fileManager.processFrontMatter(newFile, (fm) => {
      fm.nodeTypeId = nodeType.id;
    });

    if (nodeType.template && nodeType.template.trim() !== "") {
      const templateApplied = await applyTemplate({
        app,
        targetFile: newFile,
        templateName: nodeType.template,
      });
      if (!templateApplied) {
        new Notice(
          `Warning: Could not apply template "${nodeType.template}"`,
          3000,
        );
      }
    }

    const notice = new DocumentFragment();
    const spanEl = notice.createEl("span", {
      text: "Created discourse node: ",
    });

    const linkEl = spanEl.createEl("a", {
      text: formattedNodeName,
      cls: "clickable-link",
    });
    linkEl.style.textDecoration = "underline";
    linkEl.style.cursor = "pointer";
    linkEl.addEventListener("click", () => {
      app.workspace.openLinkText(formattedNodeName, "", false);
    });

    new Notice(notice, 4000);

    return newFile;
  } catch (error) {
    console.error("Error creating discourse node:", error);
    new Notice(
      `Error creating node: ${error instanceof Error ? error.message : String(error)}`,
      5000,
    );
    return null;
  }
};

export const createDiscourseNode = async ({
  plugin,
  nodeType,
  text,
  editor,
}: {
  plugin: DiscourseGraphPlugin;
  nodeType: DiscourseNode;
  text: string;
  editor?: Editor;
}): Promise<TFile | null> => {
  const formattedNodeName = formatNodeName(text, nodeType);
  if (!formattedNodeName) return null;

  const isFilenameValid = checkInvalidChars(formattedNodeName);
  if (!isFilenameValid.isValid) {
    new Notice(`${isFilenameValid.error}`, 5000);
    return null;
  }

  const newFile = await createDiscourseNodeFile({
    plugin,
    formattedNodeName,
    nodeType,
  });

  if (newFile && editor) {
    editor.replaceSelection(`[[${formattedNodeName}]]`);
  }

  return newFile;
};
