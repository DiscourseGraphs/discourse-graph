import { renderModifyNodeDialog } from "~/components/ModifyNodeDialog";
import { insertPageRefAtRange } from "~/utils/advancedSearchFooterUtils";
import type { OnloadArgs } from "roamjs-components/types";

type OpenCreateNodeDialogFromSelectionArgs = {
  blockUid: string;
  extensionAPI: OnloadArgs["extensionAPI"];
  nodeType: string;
  onInserted?: (pageTitle: string) => void;
  selectedText: string;
  selectionEnd: number;
  selectionStart: number;
  windowId: string;
};

export const openCreateNodeDialogFromSelection = ({
  blockUid,
  extensionAPI,
  nodeType,
  onInserted,
  selectedText,
  selectionEnd,
  selectionStart,
  windowId,
}: OpenCreateNodeDialogFromSelectionArgs): void => {
  renderModifyNodeDialog({
    mode: "create",
    nodeType,
    initialValue: { text: selectedText, uid: "" },
    extensionAPI,
    onSuccess: async (result) => {
      await insertPageRefAtRange({
        blockUid,
        pageTitle: result.text,
        selectionEnd,
        selectionStart,
        windowId,
      });
      onInserted?.(result.text);
    },
    onClose: () => {},
  });
};
