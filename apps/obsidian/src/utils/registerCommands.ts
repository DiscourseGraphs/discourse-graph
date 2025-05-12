import { Editor, MarkdownView, MarkdownFileInfo } from "obsidian";
import { SampleModal } from "~/components/SampleModal";
import type DiscourseGraphPlugin from "~/index";
import { NodeTypeModal } from "~/components/NodeTypeModal";

export const registerCommands = (plugin: DiscourseGraphPlugin) => {


  plugin.addCommand({
    id: "open-node-type-menu",
    name: "Open Node Type Menu",
    hotkeys: [{ modifiers: ["Mod"], key: "\\" }],
    editorCallback: (editor: Editor) => {
      new NodeTypeModal(plugin.app, editor, plugin.settings.nodeTypes).open();
    },
  });

  plugin.addCommand({
    id: "toggle-discourse-context",
    name: "Toggle Discourse Context",
    callback: () => {
      plugin.toggleDiscourseContextView();
    },
  });
};
