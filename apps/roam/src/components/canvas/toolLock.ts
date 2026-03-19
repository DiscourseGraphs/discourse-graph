import { Editor } from "tldraw";

export const setCurrentToolToSelectIfUnlocked = (editor: Editor): void => {
  if (!editor.getInstanceState().isToolLocked) {
    editor.setCurrentTool("select");
  }
};
