import { Editor, Notice, TFile } from "obsidian";
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

    const folderPath =
      nodeType.folderPath?.trim() || settings.nodesFolderPath.trim();
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
    const wrapper = document.createElement("span");
    wrapper.textContent = "Created discourse node: ";
    const linkEl = document.createElement("a");
    linkEl.textContent = formattedNodeName;
    linkEl.classList.add("dg-clickable-link");
    wrapper.appendChild(linkEl);
    notice.appendChild(wrapper);
    linkEl.addEventListener("click", () => {
      void app.workspace.openLinkText(formattedNodeName, "", false);
    });

    new Notice(notice, 10000);

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

  if (newFile && editor && editor.somethingSelected()) {
    editor.replaceSelection(`[[${formattedNodeName}]]`);
  }

  return newFile;
};

export const convertPageToDiscourseNode = async ({
  plugin,
  file,
  nodeType,
  title,
}: {
  plugin: DiscourseGraphPlugin;
  file: TFile;
  nodeType: DiscourseNode;
  title?: string;
}): Promise<void> => {
  try {
    const formattedNodeName = formatNodeName(title || file.basename, nodeType);
    if (!formattedNodeName) {
      new Notice("Failed to format node name", 3000);
      return;
    }

    const isFilenameValid = checkInvalidChars(formattedNodeName);
    if (!isFilenameValid.isValid) {
      new Notice(`${isFilenameValid.error}`, 5000);
      return;
    }

    let newPath = "";
    const folderPath =
      nodeType.folderPath?.trim() || plugin.settings.nodesFolderPath.trim();
    if (folderPath) {
      newPath = `${folderPath}/${formattedNodeName}.md`;
    } else {
      const dirPath = file.parent?.path ?? "";
      newPath = dirPath
        ? `${dirPath}/${formattedNodeName}.md`
        : `${formattedNodeName}.md`;
    }

    const destinationFile = plugin.app.vault.getAbstractFileByPath(newPath);
    if (
      destinationFile instanceof TFile &&
      destinationFile.path !== file.path
    ) {
      const notice = new DocumentFragment();
      const wrapper = document.createElement("span");
      wrapper.textContent = "Destination file already exists at ";
      const linkEl = document.createElement("a");
      linkEl.textContent = destinationFile.path;
      linkEl.classList.add("dg-clickable-link");
      wrapper.appendChild(linkEl);
      notice.appendChild(wrapper);
      linkEl.addEventListener("click", () => {
        void plugin.app.workspace.openLinkText(destinationFile.path, "", false);
      });

      new Notice(notice, 5000);
      return;
    }

    if (file.path !== newPath) {
      if (folderPath) {
        const folderExists = plugin.app.vault.getAbstractFileByPath(folderPath);
        if (!folderExists) {
          await plugin.app.vault.createFolder(folderPath);
        }
      }
      await plugin.app.fileManager.renameFile(file, newPath);
    }

    await plugin.app.fileManager.processFrontMatter(
      file,
      (fm: Record<string, unknown>) => {
        fm.nodeTypeId = nodeType.id;
      },
    );

    new Notice("Converted page to discourse node", 10000);
  } catch (error) {
    console.error("Error converting to discourse node:", error);
    new Notice(
      `Error converting to discourse node: ${error instanceof Error ? error.message : String(error)}`,
      5000,
    );
  }
};
