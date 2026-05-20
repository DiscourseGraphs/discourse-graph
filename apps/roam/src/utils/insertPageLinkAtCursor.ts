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

export const resolvePageLinkTitle = ({
  pageTitleFromUid,
  resultTitle,
}: {
  pageTitleFromUid: string | null;
  resultTitle: string;
}): string => pageTitleFromUid ?? stripTypePrefix(resultTitle);

export const getPageLinkTitle = ({
  resultUid,
  resultTitle,
}: {
  resultUid: string;
  resultTitle: string;
}): string =>
  resolvePageLinkTitle({
    pageTitleFromUid: getPageTitleByPageUid(resultUid),
    resultTitle,
  });

export const buildBlockTextWithPageLink = ({
  originalText,
  pageTitle,
  selectionEnd,
  selectionStart,
}: {
  originalText: string;
  pageTitle: string;
  selectionEnd: number;
  selectionStart: number;
}): { newCursorPosition: number; newText: string; pageRef: string } => {
  const pageRef = `[[${pageTitle}]]`;
  const newText = `${originalText.substring(0, selectionStart)}${pageRef}${originalText.substring(selectionEnd)}`;
  const newCursorPosition = selectionStart + pageRef.length;

  return { newCursorPosition, newText, pageRef };
};

const findBlockTextarea = (blockUid: string): HTMLTextAreaElement | null => {
  const textareas = document.querySelectorAll("textarea.rm-block-input");
  for (const el of textareas) {
    const textarea = el as HTMLTextAreaElement;
    if (getUids(textarea).blockUid === blockUid) {
      return textarea;
    }
  }
  return null;
};

const resolveInsertTarget = (
  snapshot: InsertTarget | null,
): InsertTarget | null => {
  if (snapshot?.blockUid) return snapshot;

  const focusedBlock = window.roamAlphaAPI.ui.getFocusedBlock();
  if (focusedBlock?.["block-uid"]) {
    return {
      blockUid: focusedBlock["block-uid"],
      windowId: focusedBlock["window-id"] || "main-window",
    };
  }

  const textareas = document.querySelectorAll("textarea.rm-block-input");
  for (const el of textareas) {
    const textarea = el as HTMLTextAreaElement;
    const blockUid = getUids(textarea).blockUid;
    if (blockUid) {
      return { blockUid, windowId: "main-window" };
    }
  }

  return null;
};

const restoreBlockFocus = ({
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

export const hasInsertTarget = (snapshot: InsertTarget | null): boolean =>
  !!resolveInsertTarget(snapshot);

export const insertPageLinkAtCursor = async ({
  pageTitle,
  snapshot,
}: {
  pageTitle: string;
  snapshot: InsertTarget | null;
}): Promise<boolean> => {
  const target = resolveInsertTarget(snapshot);
  if (!target) return false;

  const { blockUid, windowId } = target;
  const textarea = findBlockTextarea(blockUid);
  if (textarea && document.activeElement === textarea) {
    document.body.click();
  }

  const { selectionEnd, selectionStart } = getBlockSelection(blockUid);
  const originalText = getTextByBlockUid(blockUid) || "";
  const { newCursorPosition, newText } = buildBlockTextWithPageLink({
    originalText,
    pageTitle,
    selectionEnd,
    selectionStart,
  });

  await updateBlock({ uid: blockUid, text: newText });
  restoreBlockFocus({ blockUid, newCursorPosition, windowId });
  return true;
};

export const snapshotInsertTarget = (): InsertTarget | null => {
  const focusedBlock = window.roamAlphaAPI.ui.getFocusedBlock();
  if (focusedBlock?.["block-uid"]) {
    return {
      blockUid: focusedBlock["block-uid"],
      windowId: focusedBlock["window-id"] || "main-window",
    };
  }

  const activeElement = document.activeElement;
  if (
    activeElement instanceof HTMLTextAreaElement &&
    activeElement.classList.contains("rm-block-input")
  ) {
    const blockUid = getUids(activeElement).blockUid;
    if (blockUid) {
      return { blockUid, windowId: "main-window" };
    }
  }

  return null;
};
