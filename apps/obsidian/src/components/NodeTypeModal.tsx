import { App, Editor, SuggestModal, TFile, Notice } from "obsidian";
import { DiscourseNode } from "~/types";
import { getDiscourseNodeFormatExpression } from "~/utils/getDiscourseNodeFormatExpression";
import { checkInvalidChars } from "~/utils/validateNodeType";

export class NodeTypeModal extends SuggestModal<DiscourseNode> {
  constructor(
    app: App,
    private editor: Editor,
    private nodeTypes: DiscourseNode[],
  ) {
    super(app);
  }

  getItemText(item: DiscourseNode): string {
    return item.name;
  }

  getSuggestions() {
    const query = this.inputEl.value.toLowerCase();
    return this.nodeTypes.filter((node) =>
      this.getItemText(node).toLowerCase().includes(query),
    );
  }

  renderSuggestion(nodeType: DiscourseNode, el: HTMLElement) {
    el.createEl("div", { text: nodeType.name });
  }

  async createDiscourseNode(
    title: string,
    nodeType: DiscourseNode,
  ): Promise<TFile | null> {
    try {
      const instanceId = `${nodeType.id}-${Date.now()}`;
      const filename = `${title}.md`;

      await this.app.vault.create(filename, "");

      const newFile = this.app.vault.getAbstractFileByPath(filename);
      if (!(newFile instanceof TFile)) {
        throw new Error("Failed to create new file");
      }

      await this.app.fileManager.processFrontMatter(newFile, (fm) => {
        fm.nodeTypeId = nodeType.id;
        fm.nodeInstanceId = instanceId;
      });

      new Notice(`Created discourse node: ${title}`);
      return newFile;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      new Notice(`Error creating discourse node: ${errorMessage}`, 5000);
      console.error("Failed to create discourse node:", error);
      return null;
    }
  }

  async onChooseSuggestion(nodeType: DiscourseNode) {
    const selectedText = this.editor.getSelection();
    const regex = getDiscourseNodeFormatExpression(nodeType.format);

    const nodeFormat = regex.source.match(/^\^(.*?)\(\.\*\?\)(.*?)\$$/);
    if (!nodeFormat) return;

    const formattedNodeName =
      nodeFormat[1]?.replace(/\\/g, "") +
      selectedText +
      nodeFormat[2]?.replace(/\\/g, "");

    const isFilenameValid = checkInvalidChars(formattedNodeName);
    if (!isFilenameValid.isValid) {
      new Notice(`${isFilenameValid.error}`, 5000);
      return;
    }

    const newFile = await this.createDiscourseNode(formattedNodeName, nodeType);
    if (newFile) {
      this.editor.replaceSelection(`[[${formattedNodeName}]]`);
    }
  }
}
