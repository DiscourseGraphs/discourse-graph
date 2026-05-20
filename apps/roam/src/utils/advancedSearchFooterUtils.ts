import getUids from "roamjs-components/dom/getUids";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import { stripTypePrefix } from "~/components/AdvancedNodeSearchDialog/utils";

export type BlockSelection = {
  selectionStart: number;
  selectionEnd: number;
  selectedText: string;
};

export type InsertTarget = {
  blockUid: string;
  windowId: string;
  selectionStart: number;
  selectionEnd: number;
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

const insertTargetFromFocusedBlock = (): InsertTarget | null => {
  const focusedBlock = window.roamAlphaAPI.ui.getFocusedBlock();
  if (!focusedBlock?.["block-uid"]) return null;
  if (!focusedBlock["window-id"]) return null;
  const selection = getBlockSelection(focusedBlock["block-uid"]);

  return {
    blockUid: focusedBlock["block-uid"],
    windowId: focusedBlock["window-id"],
    selectionStart: selection.selectionStart,
    selectionEnd: selection.selectionEnd,
  };
};

const getWindowIdFromUids = (uids: Record<string, unknown>): string | null => {
  const windowId = uids["window-id"];
  if (typeof windowId === "string" && windowId) return windowId;

  const camelWindowId = uids.windowId;
  if (typeof camelWindowId === "string" && camelWindowId) return camelWindowId;

  return null;
};

export const snapshotInsertTarget = (): InsertTarget | null => {
  const fromApi = insertTargetFromFocusedBlock();
  if (fromApi) return fromApi;

  const activeElement = document.activeElement;
  if (
    activeElement instanceof HTMLTextAreaElement &&
    activeElement.classList.contains("rm-block-input")
  ) {
    const uids = getUids(activeElement) as Record<string, unknown>;
    const blockUid = uids.blockUid;
    const windowId = getWindowIdFromUids(uids);
    if (
      typeof blockUid === "string" &&
      blockUid &&
      typeof windowId === "string" &&
      windowId
    ) {
      return {
        blockUid,
        windowId,
        selectionStart: activeElement.selectionStart,
        selectionEnd: activeElement.selectionEnd,
      };
    }
  }

  return null;
};

const findBlockTextarea = (blockUid: string): HTMLTextAreaElement | null => {
  const textareas = document.querySelectorAll("textarea.rm-block-input");
  for (const el of textareas) {
    const textarea = el as HTMLTextAreaElement;
    if (getUids(textarea).blockUid === blockUid) return textarea;
  }
  return null;
};

export const getPageLinkTitle = ({
  resultUid,
  resultTitle,
}: {
  resultUid: string;
  resultTitle: string;
}): string => getPageTitleByPageUid(resultUid) ?? stripTypePrefix(resultTitle);

export const restoreBlockFocus = ({
  blockUid,
  newCursorPosition,
  windowId,
}: {
  blockUid: string;
  newCursorPosition: number;
  windowId: string;
}): void => {
  if (window.roamAlphaAPI.ui.setBlockFocusAndSelection) {
    void window.roamAlphaAPI.ui.setBlockFocusAndSelection({
      location: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "block-uid": blockUid,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "window-id": windowId,
      },
      selection: { start: newCursorPosition },
    });
    return;
  }

  setTimeout(() => {
    const textarea = findBlockTextarea(blockUid);
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(newCursorPosition, newCursorPosition);
  }, 50);
};

export const insertPageRefAtRange = async ({
  blockUid,
  pageTitle,
  selectionEnd,
  selectionStart,
  windowId,
}: {
  blockUid: string;
  pageTitle: string;
  selectionEnd: number;
  selectionStart: number;
  windowId: string;
}): Promise<void> => {
  const pageRef = `[[${pageTitle}]]`;
  const originalText = getTextByBlockUid(blockUid) || "";
  const newText = `${originalText.substring(0, selectionStart)}${pageRef}${originalText.substring(selectionEnd)}`;
  const newCursorPosition = selectionStart + pageRef.length;

  await updateBlock({ uid: blockUid, text: newText });
  restoreBlockFocus({ blockUid, newCursorPosition, windowId });
};

export const insertPageLinkAtCursor = async ({
  pageTitle,
  snapshot,
}: {
  pageTitle: string;
  snapshot: InsertTarget | null;
}): Promise<boolean> => {
  const target = snapshot ?? insertTargetFromFocusedBlock();
  if (!target) return false;

  const { blockUid, selectionEnd, selectionStart, windowId } = target;
  const textarea = findBlockTextarea(blockUid);

  if (textarea && document.activeElement === textarea) {
    textarea.blur();
  }

  await insertPageRefAtRange({
    blockUid,
    pageTitle,
    selectionEnd,
    selectionStart,
    windowId,
  });
  return true;
};
