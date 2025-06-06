import { Editor } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { NodeTypeModal } from "~/components/NodeTypeModal";
import { CreateNodeModal } from "~/components/CreateNodeModal";
import { createDiscourseNode } from "./createNode";

export const registerCommands = (plugin: DiscourseGraphPlugin) => {
  plugin.addCommand({
    id: "open-node-type-menu",
    name: "Open Node Type Menu",
    hotkeys: [{ modifiers: ["Mod"], key: "\\" }],
    editorCallback: (editor: Editor) => {
      const hasSelection = editor.getSelection();

      if (hasSelection) {
        new NodeTypeModal(editor, plugin.settings.nodeTypes, plugin).open();
      } else {
        new CreateNodeModal(plugin.app, {
          nodeTypes: plugin.settings.nodeTypes,
          plugin,
          onNodeCreate: async (nodeType, title) => {
            await createDiscourseNode({
              plugin,
              nodeType,
              text: title,
              editor,
            });
          },
        }).open();
      }
    },
  });

  plugin.addCommand({
    id: "create-discourse-node",
    name: "Create Discourse Node",
    editorCallback: (editor: Editor) => {
      new CreateNodeModal(plugin.app, {
        nodeTypes: plugin.settings.nodeTypes,
        plugin,
        onNodeCreate: async (nodeType, title) => {
          await createDiscourseNode({
            plugin,
            nodeType,
            text: title,
            editor,
          });
        },
      }).open();
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
