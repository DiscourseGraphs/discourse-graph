import {
  renderModifyNodeDialog,
  type ModifyNodeDialogProps,
} from "~/components/ModifyNodeDialog";
import { restoreBlockFocus } from "~/utils/advancedSearchFooterUtils";
import { render as renderToast } from "roamjs-components/components/Toast";
import type { Result } from "~/utils/types";
import type { OnloadArgs } from "roamjs-components/types";

type DialogResult = Parameters<ModifyNodeDialogProps["onSuccess"]>[0];

export const openCreateNodeDialogAtRange = ({
  blockUid,
  extensionAPI,
  initialReferencedNode,
  nodeType,
  onInserted,
  originalText,
  selectionEnd,
  selectionStart,
  windowId,
}: {
  blockUid: string;
  extensionAPI: OnloadArgs["extensionAPI"];
  initialReferencedNode?: Result;
  nodeType: string;
  onInserted?: (result: DialogResult) => void;
  originalText: string;
  selectionEnd: number;
  selectionStart: number;
  windowId: string;
}): void => {
  const assertTargetUnchanged = (): void => {
    const block = window.roamAlphaAPI.pull("[:block/string]", [
      ":block/uid",
      blockUid,
    ]);
    if (
      block?.[":block/string"] !== originalText ||
      selectionStart < 0 ||
      selectionEnd < selectionStart ||
      selectionEnd > originalText.length
    ) {
      throw new Error(
        "The original block changed or was deleted. Cancel and reopen the node menu to choose where to insert.",
      );
    }
  };

  renderModifyNodeDialog({
    mode: "create",
    nodeType,
    initialValue: {
      text: originalText.substring(selectionStart, selectionEnd),
      uid: "",
    },
    initialReferencedNode,
    extensionAPI,
    beforeSubmit: assertTargetUnchanged,
    onSuccess: async (result) => {
      try {
        // Creation can await network work after the first validation.
        assertTargetUnchanged();
        const pageRef = `[[${result.text}]]`;
        // The shared write wrapper retries busy writes later with stale text.
        await window.roamAlphaAPI.updateBlock({
          block: {
            uid: blockUid,
            string: `${originalText.slice(0, selectionStart)}${pageRef}${originalText.slice(selectionEnd)}`,
          },
        });
        restoreBlockFocus({
          blockUid,
          newCursorPosition: selectionStart + pageRef.length,
          windowId,
        });
      } catch {
        // The node already exists; close instead of offering a creation retry.
        renderToast({
          id: "node-menu-insertion-failed",
          intent: "warning",
          timeout: 10000,
          content: `The node is available as [[${result.text}]], but automatic insertion could not be completed. Check the original block before inserting the existing node.`,
        });
        return;
      }
      onInserted?.(result);
    },
    onClose: () => {},
  });
};
