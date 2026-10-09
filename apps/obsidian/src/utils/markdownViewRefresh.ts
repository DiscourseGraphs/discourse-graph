import { MarkdownView, type App } from "obsidian";
import type { EditorView } from "@codemirror/view";

type EditorWithCm = { cm: EditorView };

export const hasCodeMirrorView = (editor: unknown): editor is EditorWithCm => {
  if (!editor || typeof editor !== "object") return false;
  return "cm" in editor;
};

/**
 * Empty CM6 transaction to every open editor, forcing ViewPlugin.update() to
 * run when something it reads changes outside the editor.
 */
export const refreshMarkdownEditors = (app: App): void => {
  app.workspace.iterateAllLeaves((leaf) => {
    if (
      leaf.view instanceof MarkdownView &&
      hasCodeMirrorView(leaf.view.editor)
    ) {
      leaf.view.editor.cm.dispatch({});
    }
  });
};
