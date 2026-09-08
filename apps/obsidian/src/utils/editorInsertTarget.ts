import { App, MarkdownView, TFile, type EditorPosition } from "obsidian";

/** Held rather than re-looked-up, so the link lands in the pre-open note. */
export type EditorInsertTarget = {
  view: MarkdownView;
  from: EditorPosition;
  to: EditorPosition;
};

/**
 * Call before the modal mounts, while the editor still owns the cursor.
 * `hasFocus()` is not part of the gate: opening the search from the command
 * palette means that palette already took focus.
 */
export const snapshotInsertTarget = (app: App): EditorInsertTarget | null => {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  // Reading mode has no cursor.
  if (!view || !view.file || view.getMode() !== "source") return null;

  const { editor } = view;
  return {
    view,
    // A selection is replaced rather than left beside the link.
    from: editor.getCursor("from"),
    to: editor.getCursor("to"),
  };
};

/** `generateMarkdownLink` is what honours the vault's link-format settings. */
export const insertLinkAtInsertTarget = ({
  app,
  file,
  target,
}: {
  app: App;
  file: TFile;
  target: EditorInsertTarget;
}): void => {
  const { view, from, to } = target;
  const sourceFile = view.file;
  if (!sourceFile) return;

  const link = app.fileManager.generateMarkdownLink(file, sourceFile.path);
  const { editor } = view;
  editor.replaceRange(link, from, to);

  app.workspace.setActiveLeaf(view.leaf, { focus: true });
  editor.setCursor({ line: from.line, ch: from.ch + link.length });
  editor.focus();
};
