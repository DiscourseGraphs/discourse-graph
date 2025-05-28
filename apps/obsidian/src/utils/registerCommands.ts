import { Editor } from "obsidian";
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

  plugin.addCommand({
    id: "open-discourse-graph-settings",
    name: "Open Discourse Graph Settings",
    callback: () => {
      // plugin.app.setting is an unofficial API
      const setting = (plugin.app as any).setting;
      setting.open();
      setting.openTabById(plugin.manifest.id);
    },
  });
};
