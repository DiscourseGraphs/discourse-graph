import { TFile, type App } from "obsidian";
import { useCallback, useEffect, useRef } from "react";

const NOTE_EXTENSIONS = new Set(["md", "base", "canvas"]);

/** Plugin data files such as relations.json are created on the side and aren't the user's notes. */
export const isTutorialNote = (file: TFile): boolean =>
  NOTE_EXTENSIONS.has(file.extension);

/**
 * Collects notes created while the tour runs. Keeping the TFile rather than its path
 * follows renames, which tutorials cause when the user names a new note.
 */
export const useCreatedNotes = (app: App): (() => TFile[]) => {
  const created = useRef<TFile[]>([]);

  useEffect(() => {
    const ref = app.vault.on("create", (file) => {
      if (file instanceof TFile && isTutorialNote(file)) {
        created.current.push(file);
      }
    });
    return () => app.vault.offref(ref);
  }, [app]);

  return useCallback(
    () =>
      created.current.filter(
        (file) => app.vault.getAbstractFileByPath(file.path) === file,
      ),
    [app],
  );
};
