import { MarkdownView, type App } from "obsidian";
import type { EditorView } from "@codemirror/view";

type EditorWithCm = { cm: EditorView };

export const hasCodeMirrorView = (editor: unknown): editor is EditorWithCm => {
  if (!editor || typeof editor !== "object") return false;
  return "cm" in editor;
};

/**
 * Dispatches an empty CM6 transaction to every open markdown editor, which
 * forces each ViewPlugin's update() to run and rebuild its decorations.
 *
 * Needed whenever something a ViewPlugin reads changes outside the editor —
 * a setting, or which leaves are visible — since CM6 has no way to know.
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

/**
 * Re-renders every open Reading view.
 *
 * Reading view has no equivalent of the CM6 no-op transaction: markdown post
 * processors only run when content is rendered, so a setting that changes what
 * they emit needs the already-rendered content thrown away and rebuilt.
 */
export const refreshMarkdownPreviews = (app: App): void => {
  app.workspace.iterateAllLeaves((leaf) => {
    if (leaf.view instanceof MarkdownView) {
      leaf.view.previewMode?.rerender(true);
    }
  });
};
