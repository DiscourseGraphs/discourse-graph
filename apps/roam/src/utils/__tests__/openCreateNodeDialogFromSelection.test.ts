import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OnloadArgs } from "roamjs-components/types";
import type { ModifyNodeDialogProps } from "~/components/ModifyNodeDialog";

type InsertPageRefAtRangeArgs = {
  blockUid: string;
  pageTitle: string;
  selectionEnd: number;
  selectionStart: number;
  windowId: string;
};

const mocks = vi.hoisted(() => ({
  insertPageRefAtRange:
    vi.fn<(args: InsertPageRefAtRangeArgs) => Promise<void>>(),
  renderModifyNodeDialog: vi.fn<(props: ModifyNodeDialogProps) => void>(),
}));

vi.mock("~/components/ModifyNodeDialog", () => ({
  renderModifyNodeDialog: mocks.renderModifyNodeDialog,
}));

vi.mock("~/utils/advancedSearchFooterUtils", () => ({
  insertPageRefAtRange: mocks.insertPageRefAtRange,
}));

import { openCreateNodeDialogFromSelection } from "~/utils/openCreateNodeDialogFromSelection";

describe("openCreateNodeDialogFromSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertPageRefAtRange.mockResolvedValue(undefined);
  });

  it("prefills the dialog and replaces the selected text after creation", async () => {
    const extensionAPI = {} as OnloadArgs["extensionAPI"];
    const onInserted = vi.fn();

    openCreateNodeDialogFromSelection({
      blockUid: "block-uid",
      extensionAPI,
      nodeType: "node-type-uid",
      onInserted,
      selectedText: "highlighted text",
      selectionEnd: 20,
      selectionStart: 4,
      windowId: "main-window",
    });

    expect(mocks.renderModifyNodeDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionAPI,
        initialValue: { text: "highlighted text", uid: "" },
        mode: "create",
        nodeType: "node-type-uid",
      }),
    );

    const dialogProps = mocks.renderModifyNodeDialog.mock.calls[0][0];
    await dialogProps.onSuccess({
      action: "create",
      text: "CLM - highlighted text",
      uid: "new-node-uid",
    });

    expect(mocks.insertPageRefAtRange).toHaveBeenCalledWith({
      blockUid: "block-uid",
      pageTitle: "CLM - highlighted text",
      selectionEnd: 20,
      selectionStart: 4,
      windowId: "main-window",
    });
    expect(onInserted).toHaveBeenCalledWith("CLM - highlighted text");
  });
});
