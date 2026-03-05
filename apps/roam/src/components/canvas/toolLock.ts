import { Editor } from "tldraw";

export const setCurrentToolToSelectIfUnlocked = (editor: Editor): void => {
  if (!editor.getInstanceState().isToolLocked) {
    editor.setCurrentTool("select");
  }
};

/** Lock the tool when switching to a discourse graph tool so the user stays on that tool until they choose select. */
export const lockTool = (editor: Editor): void => {
  if (!editor.getInstanceState().isToolLocked) {
    editor.updateInstanceState({ isToolLocked: true });
  }
};

/** When the user selects the select tool, clear tool lock so we only lock while on discourse tools. */
export const unlockToolWhenSelect = (editor: Editor): void => {
  if (editor.getCurrentToolId() === "select") {
    editor.updateInstanceState({ isToolLocked: false });
  }
};

/** Unlock the tool (e.g. when opening a dialog so the user is not stuck with Select + locked). */
export const unlockTool = (editor: Editor): void => {
  editor.updateInstanceState({ isToolLocked: false });
};
