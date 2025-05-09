import { App, Editor, Notice, TFile } from "obsidian";
import { DiscourseNode } from "~/types";
import { getDiscourseNodeFormatExpression } from "./getDiscourseNodeFormatExpression";
import { checkInvalidChars } from "./validateNodeType";

export function formatNodeName(
  selectedText: string,
  nodeType: DiscourseNode,
): string | null {
  const regex = getDiscourseNodeFormatExpression(nodeType.format);
  const nodeFormat = regex.source.match(/^\^(.*?)\(\.\*\?\)(.*?)\$$/);

  if (!nodeFormat) return null;

  return (
    nodeFormat[1]?.replace(/\\/g, "") +
    selectedText +
    nodeFormat[2]?.replace(/\\/g, "")
  );
}

export async function createDiscourseNodeFile(
  app: App,
  formattedNodeName: string,
  nodeType: DiscourseNode,
): Promise<TFile | null> {
  try {
    const existingFile = app.vault.getAbstractFileByPath(
      `${formattedNodeName}.md`,
    );
    if (existingFile && existingFile instanceof TFile) {
      new Notice(`File ${formattedNodeName} already exists`, 3000);
      return null; 
    }

    const newFile = await app.vault.create(`${formattedNodeName}.md`, "");
    await app.fileManager.processFrontMatter(newFile, (fm) => {
      fm.nodeTypeId = nodeType.id;
    });

    new Notice(`Created discourse node: ${formattedNodeName}`);
    return newFile;
  } catch (error) {
    console.error("Error creating discourse node:", error);
    new Notice(
      `Error creating node: ${error instanceof Error ? error.message : String(error)}`,
      5000,
    );
    return null;
  }
}
export async function processTextToDiscourseNode(
  app: any,
  editor: Editor,
  nodeType: DiscourseNode,
): Promise<TFile | null> {
  const selectedText = editor.getSelection();
  if (!selectedText) return null;

  const formattedNodeName = formatNodeName(selectedText, nodeType);
  if (!formattedNodeName) return null;

  const isFilenameValid = checkInvalidChars(formattedNodeName);
  if (!isFilenameValid.isValid) {
    new Notice(`${isFilenameValid.error}`, 5000);
    return null;
  }

  const newFile = await createDiscourseNodeFile(
    app,
    formattedNodeName,
    nodeType,
  );
  if (newFile) {
    editor.replaceSelection(`[[${formattedNodeName}]]`);
  }

  return newFile;
}
