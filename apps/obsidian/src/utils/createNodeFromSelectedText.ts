import { App, Editor, Notice, TFile } from "obsidian";
import { DiscourseNode } from "~/types";
import { getDiscourseNodeFormatExpression } from "./getDiscourseNodeFormatExpression";
import { checkInvalidChars } from "./validateNodeType";
import { applyTemplate } from "./templates";

export const formatNodeName = (
  selectedText: string,
  nodeType: DiscourseNode,
): string | null => {
  const regex = getDiscourseNodeFormatExpression(nodeType.format);
  const nodeFormat = regex.source.match(/^\^(.*?)\(\.\*\?\)(.*?)\$$/);

  if (!nodeFormat) return null;

  return (
    nodeFormat[1]?.replace(/\\/g, "") +
    selectedText +
    nodeFormat[2]?.replace(/\\/g, "")
  );
};

export const createDiscourseNodeFile = async ({
  app,
  formattedNodeName,
  nodeType,
}: {
  app: App;
  formattedNodeName: string;
  nodeType: DiscourseNode;
}): Promise<TFile | null> => {
  try {
    const existingFile = app.vault.getAbstractFileByPath(
      `${formattedNodeName}.md`,
    );
    if (existingFile && existingFile instanceof TFile) {
      new Notice(`File ${formattedNodeName} already exists`, 3000);
      return existingFile;
    }

    const newFile = await app.vault.create(`${formattedNodeName}.md`, "");
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

export const processTextToDiscourseNode = async ({
  app,
  editor,
  nodeType,
}: {
  app: App;
  editor: Editor;
  nodeType: DiscourseNode;
}): Promise<TFile | null> => {
  const selectedText = editor.getSelection().trim();
  
  const formattedNodeName = formatNodeName(selectedText, nodeType);
  if (!formattedNodeName) return null;

  const isFilenameValid = checkInvalidChars(formattedNodeName);
  if (!isFilenameValid.isValid) {
    new Notice(`${isFilenameValid.error}`, 5000);
    return null;
  }

  const newFile = await createDiscourseNodeFile({
    app,
    formattedNodeName,
    nodeType,
  });
  if (newFile) {
    editor.replaceSelection(`[[${formattedNodeName}]]`);
  }

  return newFile;
};
