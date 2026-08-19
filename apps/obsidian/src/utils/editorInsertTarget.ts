import { App, MarkdownView, TFile, type EditorPosition } from "obsidian";

/**
 * Where a link should land, captured before a modal opens. The view is held
 * rather than looked up again on insert, so the link cannot end up in whatever
 * note happens to be active by the time the user picks a result.
 */
export type EditorInsertTarget = {
  view: MarkdownView;
  from: EditorPosition;
  to: EditorPosition;
};

/**
 * Must be called before the modal mounts, while the editor still owns the
 * cursor. Reading mode has no cursor, so only source mode yields a target.
 *
 * `editor.hasFocus()` is deliberately not part of the gate: opening the search
 * from the command palette means that palette already took focus, which would
 * hide the insert action on its most common invocation path.
 */
export const snapshotInsertTarget = (app: App): EditorInsertTarget | null => {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  if (!view || !view.file || view.getMode() !== "source") return null;

  const { editor } = view;
  return {
    view,
    // A selection is replaced rather than left beside the link, matching the
    // Roam implementation.
    from: editor.getCursor("from"),
    to: editor.getCursor("to"),
  };
};

/**
 * `generateMarkdownLink` is what honours the vault's wikilink-vs-markdown and
 * shortest-path settings, so the link is never hand-built.
 */
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

  const cursorAfterLink = { line: from.line, ch: from.ch + link.length };
  app.workspace.setActiveLeaf(view.leaf, { focus: true });
  editor.setCursor(cursorAfterLink);
  editor.focus();
};
