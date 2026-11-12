import type { App, TFile } from "obsidian";

/**
 * `text/plain` only: a URL slot makes Obsidian compose `[text/plain](url)`, and
 * `text/html` — which Chromium fills from an `<a href>` — wins over both.
 */
export const setFileDragData = ({
  dataTransfer,
  app,
  file,
  sourcePath,
}: {
  dataTransfer: DataTransfer | null;
  app: App;
  file: TFile;
  sourcePath: string;
}): void => {
  if (!dataTransfer) return;

  // generateMarkdownLink honours the vault's link-format setting. sourcePath is
  // the panel's note, not the drop target: relative-format links can be wrong.
  dataTransfer.setData(
    "text/plain",
    app.fileManager.generateMarkdownLink(file, sourcePath),
  );
};
