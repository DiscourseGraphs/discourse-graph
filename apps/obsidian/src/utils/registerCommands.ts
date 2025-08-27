import { Editor } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { NodeTypeModal } from "~/components/NodeTypeModal";
import { CreateNodeModal } from "~/components/CreateNodeModal";
import { BulkIdentifyDiscourseNodesModal } from "~/components/BulkIdentifyDiscourseNodesModal";
import { createDiscourseNode } from "./createNode";
import { VIEW_TYPE_MARKDOWN, VIEW_TYPE_TLDRAW_DG_PREVIEW } from "~/constants";
import { createCanvas } from "../components/canvas/tldraw";

export const registerCommands = (plugin: DiscourseGraphPlugin) => {
  plugin.addCommand({
    id: "open-node-type-menu",
    name: "Open Node Type Menu",
    hotkeys: [{ modifiers: ["Mod"], key: "\\" }],
    editorCallback: (editor: Editor) => {
      const hasSelection = !!editor.getSelection();

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
    id: "bulk-identify-discourse-nodes",
    name: "Bulk Identify Discourse Nodes",
    callback: () => {
      new BulkIdentifyDiscourseNodesModal(plugin.app, plugin).open();
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

  plugin.addCommand({
    id: "switch-to-tldraw-edit",
    name: "Switch to Discourse Markdown Edit",
    checkCallback: (checking: boolean) => {
      const leaf = plugin.app.workspace.activeLeaf;
      if (!leaf) return false;

      if (!checking) {
        leaf.setViewState({
          type: VIEW_TYPE_MARKDOWN,
          state: leaf.view.getState(),
        });
      }
      return true;
    },
  });

  plugin.addCommand({
    id: "switch-to-tldraw-preview",
    name: "Switch to Discourse Graph Canvas View",
    checkCallback: (checking: boolean) => {
      const leaf = plugin.app.workspace.activeLeaf;
      if (!leaf) return false;

      if (!checking) {
        leaf.setViewState({
          type: VIEW_TYPE_TLDRAW_DG_PREVIEW,
          state: leaf.view.getState(),
        });
      }
      return true;
    },
  });

  plugin.addCommand({
    id: "create-discourse-graph-canvas",
    name: "Create new Discourse Graph canvas",
    icon: "layout-dashboard", // Using Lucide icon as per style guide
    callback: () => createCanvas(plugin),
  });
};
