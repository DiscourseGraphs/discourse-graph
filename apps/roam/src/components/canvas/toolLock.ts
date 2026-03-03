import { Editor } from "tldraw";

export const setCurrentToolToSelectIfUnlocked = (editor: Editor): void => {
  if (!editor.getInstanceState().isToolLocked) {
    editor.setCurrentTool("select");
  }
};

export const lockToolIfNeeded = (editor: Editor): void => {
  if (!editor.getInstanceState().isToolLocked) {
    editor.updateInstanceState({ isToolLocked: true });
  }
};