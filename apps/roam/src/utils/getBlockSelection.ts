import getUids from "roamjs-components/dom/getUids";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";

export type BlockSelection = {
  selectionStart: number;
  selectionEnd: number;
  selectedText: string;
};

export const getBlockSelection = (uid: string): BlockSelection => {
  const activeElement = document.activeElement;
  const isFocusedTextarea =
    activeElement instanceof HTMLTextAreaElement &&
    activeElement.classList.contains("rm-block-input") &&
    getUids(activeElement).blockUid === uid;
  if (isFocusedTextarea) {
    return {
      selectionStart: activeElement.selectionStart,
      selectionEnd: activeElement.selectionEnd,
      selectedText: activeElement.value.substring(
        activeElement.selectionStart,
        activeElement.selectionEnd,
      ),
    };
  }
  const textareas = document.querySelectorAll("textarea.rm-block-input");
  for (const el of textareas) {
    const textarea = el as HTMLTextAreaElement;
    if (getUids(textarea).blockUid === uid) {
      return {
        selectionStart: textarea.selectionStart,
        selectionEnd: textarea.selectionEnd,
        selectedText: textarea.value.substring(
          textarea.selectionStart,
          textarea.selectionEnd,
        ),
      };
    }
  }
  const textLength = (getTextByBlockUid(uid) || "").length;
  return {
    selectionStart: textLength,
    selectionEnd: textLength,
    selectedText: "",
  };
};
