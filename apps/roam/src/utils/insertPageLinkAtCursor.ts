import getUids from "roamjs-components/dom/getUids";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import { stripTypePrefix } from "~/components/AdvancedNodeSearchDialog/utils";
import { getBlockSelection } from "~/utils/getBlockSelection";

export type InsertTarget = {
  blockUid: string;
  windowId: string;
};

const DEFAULT_WINDOW_ID = "main-window";

const insertTargetFromFocusedBlock = (): InsertTarget | null => {
  const focusedBlock = window.roamAlphaAPI.ui.getFocusedBlock();
  if (!focusedBlock?.["block-uid"]) return null;

  return {
    blockUid: focusedBlock["block-uid"],
    windowId: focusedBlock["window-id"] || DEFAULT_WINDOW_ID,
  };
};

export const snapshotInsertTarget = (): InsertTarget | null => {
  const fromApi = insertTargetFromFocusedBlock();
  if (fromApi) return fromApi;

  const activeElement = document.activeElement;
  if (
    activeElement instanceof HTMLTextAreaElement &&
    activeElement.classList.contains("rm-block-input")
  ) {
    const blockUid = getUids(activeElement).blockUid;
    if (blockUid) {
      return { blockUid, windowId: DEFAULT_WINDOW_ID };
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

const getSelectionForBlock = (
  blockUid: string,
  textarea: HTMLTextAreaElement | null,
): { selectionEnd: number; selectionStart: number } => {
  if (textarea && getUids(textarea).blockUid === blockUid) {
    return {
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
    };
  }
  return getBlockSelection(blockUid);
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
  const target = snapshot?.blockUid ? snapshot : insertTargetFromFocusedBlock();
  if (!target) return false;

  const { blockUid, windowId } = target;
  const textarea = findBlockTextarea(blockUid);
  const { selectionEnd, selectionStart } = getSelectionForBlock(
    blockUid,
    textarea,
  );

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
