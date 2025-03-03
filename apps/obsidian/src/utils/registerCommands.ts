import {
  Editor,
  MarkdownFileInfo,
  MarkdownView,
  App,
  Notice,
  SuggestModal,
} from "obsidian";
import { SampleModal } from "~/components/SampleModal";
import type DiscourseGraphPlugin from "~/index";
import { NodeTypeModal } from "~/components/NodeTypeModal";

export const registerCommands = (plugin: DiscourseGraphPlugin) => {
  // This adds a simple command that can be triggered anywhere
  plugin.addCommand({
    id: "open-sample-modal-simple",
    name: "Open sample modal (simple)",
    callback: () => {
      new SampleModal(plugin.app).open();
    },
  });

  // This adds an editor command that can perform some operation on the current editor instance
  plugin.addCommand({
    id: "sample-editor-command",
    name: "Sample editor command",
    editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
      console.log(editor.getSelection());
      editor.replaceSelection("Sample Editor Command");
    },
  });

  console.log(plugin.settings);

  // This adds a complex command that can check whether the current state of the app allows execution of the command
  plugin.addCommand({
    id: "open-sample-modal-complex",
    name: "Open sample modal (complex)",
    checkCallback: (checking: boolean) => {
      // Conditions to check
      const markdownView =
        plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (markdownView) {
        // If checking is true, we're simply "checking" if the command can be run.
        // If checking is false, then we want to actually perform the operation.
        if (!checking) {
          new SampleModal(plugin.app).open();
        }

        // This command will only show up in Command Palette when the check function returns true
        return true;
      }
    },
  });

  plugin.addCommand({
    id: "open-node-type-menu",
    name: "Open Node Type Menu",
    hotkeys: [{ modifiers: ["Mod"], key: "\\" }],
    editorCallback: (editor: Editor) => {
      new NodeTypeModal(plugin.app, editor, plugin.settings.nodeTypes).open();
    },
  });
};
