import { App, Editor, Notice, Plugin, SuggestModal } from "obsidian";
import { SettingsTab } from "~/components/Settings";
import { DiscourseNodeType, Settings } from "./types";
import { getDiscourseNodeFormatExpression } from "./utils/getDiscourseNodeFormatExpression";

const DEFAULT_SETTINGS: Settings = {
  mySetting: "default",
  nodeTypes: [],
  nodeTypeHotkey: {
    modifiers: [],
    key: "",
  },
};

class NodeTypeModal extends SuggestModal<DiscourseNodeType> {
  constructor(
    app: App,
    private editor: Editor,
    private nodeTypes: DiscourseNodeType[],
  ) {
    super(app);
  }

  getItemText(item: DiscourseNodeType): string {
    return item.name;
  }

  // Get all available items
  getSuggestions() {
    const query = this.inputEl.value.toLowerCase();
    return this.nodeTypes.filter((node) =>
      this.getItemText(node).toLowerCase().includes(query),
    );
  }

  renderSuggestion(nodeType: DiscourseNodeType, el: HTMLElement) {
    el.createEl("div", { text: nodeType.name });
  }

  onChooseSuggestion(nodeType: DiscourseNodeType) {
    const selectedText = this.editor.getSelection();
    const regex = getDiscourseNodeFormatExpression(nodeType.format);

    const nodeFormat = regex.source.match(/^\^(.*?)\(\.\*\?\)(.*?)\$$/);
    if (!nodeFormat) return;

    const formattedNodeName =
      nodeFormat[1]?.replace(/\\/g, "") +
      selectedText +
      nodeFormat[2]?.replace(/\\/g, "");
    if (!nodeFormat) return;

    this.editor.replaceSelection(`[[${formattedNodeName}]]`);
  }
}

export default class DiscourseGraphPlugin extends Plugin {
  settings: Settings = { ...DEFAULT_SETTINGS };

  private registerNodeTypeCommand() {
    return this.addCommand({
      id: "open-node-type-menu",
      name: "Open Node Type Menu",
      hotkeys: [this.settings.nodeTypeHotkey],
      editorCallback: (editor: Editor) => {
        if (!this.settings.nodeTypes.length) {
          new Notice("No node types configured!");
          return;
        }

        new NodeTypeModal(this.app, editor, this.settings.nodeTypes).open();
      },
    });
  }

  async onload() {
    await this.loadSettings();
    this.registerNodeTypeCommand();
    this.addSettingTab(new SettingsTab(this.app, this));
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    await this.registerNodeTypeCommand();
  }
}
