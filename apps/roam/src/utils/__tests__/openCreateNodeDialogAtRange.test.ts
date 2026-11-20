import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModifyNodeDialogProps } from "~/components/ModifyNodeDialog";
import type { OnloadArgs } from "roamjs-components/types";
import { openCreateNodeDialogAtRange } from "~/utils/openCreateNodeDialogAtRange";

const mocks = vi.hoisted(() => ({
  renderDialog: vi.fn<(props: ModifyNodeDialogProps) => void>(),
  updateBlock: vi.fn<(args: { uid: string; text: string }) => Promise<void>>(),
  sharedUpdateBlock: vi.fn(),
  readText: vi.fn(),
  pull: vi.fn(),
  focus: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("~/components/ModifyNodeDialog", () => ({
  renderModifyNodeDialog: mocks.renderDialog,
}));
vi.mock("roamjs-components/components/Toast", () => ({ render: mocks.toast }));
vi.mock("roamjs-components/writes/updateBlock", () => ({
  default: mocks.sharedUpdateBlock,
}));
vi.mock("roamjs-components/queries/getTextByBlockUid", () => ({
  default: mocks.readText,
}));

const originalText = "Before selected after";
const open = (
  overrides: Partial<Parameters<typeof openCreateNodeDialogAtRange>[0]> = {},
): ModifyNodeDialogProps => {
  openCreateNodeDialogAtRange({
    blockUid: "block-uid",
    extensionAPI: {} as OnloadArgs["extensionAPI"],
    nodeType: "evidence",
    initialReferencedNode: { text: "@Source", uid: "source-uid" },
    originalText,
    selectionStart: 7,
    selectionEnd: 15,
    windowId: "sidebar-window",
    ...overrides,
  });
  return mocks.renderDialog.mock.calls[0][0];
};
const result = {
  text: "EVD selected [[@Source]]",
  uid: "new-node",
  action: "create",
  nodeType: "evidence",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pull.mockReturnValue({ ":block/string": originalText });
  mocks.readText.mockReturnValue(originalText);
  mocks.updateBlock.mockResolvedValue(undefined);
  vi.stubGlobal("window", {
    roamAlphaAPI: {
      pull: mocks.pull,
      updateBlock: ({ block }: { block: { uid: string; string: string } }) =>
        mocks.updateBlock({ uid: block.uid, text: block.string }),
      ui: { setBlockFocusAndSelection: mocks.focus },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("node menu dialog insertion", () => {
  it("prefills the existing dialog and replaces only the selection with its actual result", async () => {
    const onInserted = vi.fn();
    const props = open({ onInserted });
    expect(props).toMatchObject({
      mode: "create",
      nodeType: "evidence",
      initialValue: { text: "selected", uid: "" },
      initialReferencedNode: { text: "@Source", uid: "source-uid" },
    });
    expect(props).not.toHaveProperty("sourceBlockUid");
    props.beforeSubmit?.();
    await props.onSuccess({ ...result, nodeType: "changed-type" });
    expect(mocks.updateBlock).toHaveBeenCalledExactlyOnceWith({
      uid: "block-uid",
      text: "Before [[EVD selected [[@Source]]]] after",
    });
    expect(onInserted).toHaveBeenCalledWith({
      ...result,
      nodeType: "changed-type",
    });
    expect(mocks.focus).toHaveBeenCalledWith(
      expect.objectContaining({
        location: { "block-uid": "block-uid", "window-id": "sidebar-window" },
      }),
    );
  });

  it.each([0, 7, originalText.length])(
    "inserts at a collapsed cursor at %i",
    async (position) => {
      const props = open({ selectionStart: position, selectionEnd: position });
      expect(props.initialValue.text).toBe("");
      props.beforeSubmit?.();
      await props.onSuccess(result);
      expect(mocks.updateBlock).toHaveBeenCalledWith({
        uid: "block-uid",
        text:
          originalText.slice(0, position) +
          "[[" +
          result.text +
          "]]" +
          originalText.slice(position),
      });
    },
  );

  it("inserts into an unchanged empty block", async () => {
    mocks.pull.mockReturnValue({ ":block/string": "" });
    mocks.readText.mockReturnValue("");
    const props = open({
      originalText: "",
      selectionStart: 0,
      selectionEnd: 0,
    });
    props.beforeSubmit?.();
    await props.onSuccess(result);
    expect(mocks.updateBlock).toHaveBeenCalledWith({
      uid: "block-uid",
      text: "[[" + result.text + "]]",
    });
  });

  it.each([{ ":block/string": "Edited selected after" }, undefined])(
    "rejects an edited or deleted block before submission",
    (block) => {
      const props = open();
      mocks.pull.mockReturnValue(block);
      expect(() => props.beforeSubmit?.()).toThrow("changed or was deleted");
      expect(mocks.updateBlock).not.toHaveBeenCalled();
    },
  );

  it.each([
    [-1, 5],
    [10, 5],
    [0, 100],
  ])("rejects invalid range %i..%i", (start, end) => {
    const props = open({ selectionStart: start, selectionEnd: end });
    expect(() => props.beforeSubmit?.()).toThrow();
  });

  it("does not recreate or overwrite when the block changes during node creation", async () => {
    const onInserted = vi.fn();
    const props = open({ onInserted });
    props.beforeSubmit?.();
    mocks.pull.mockReturnValue({ ":block/string": "new collaborator text" });
    await expect(props.onSuccess(result)).resolves.toBeUndefined();
    expect(mocks.updateBlock).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ intent: "warning" }),
    );
    expect(onInserted).not.toHaveBeenCalled();
  });

  it("reports a failed insertion without requesting another creation", async () => {
    const props = open();
    mocks.updateBlock.mockRejectedValue(new Error("write failed"));
    await expect(props.onSuccess(result)).resolves.toBeUndefined();
    expect(mocks.toast).toHaveBeenCalledOnce();
  });

  it("does not retry a busy insertion against a later edit", async () => {
    vi.useFakeTimers();
    try {
      const props = open();
      mocks.updateBlock.mockRejectedValue({ code: "busy" });
      await props.onSuccess(result);
      mocks.pull.mockReturnValue({ ":block/string": "collaborator edit" });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mocks.updateBlock).toHaveBeenCalledOnce();
      expect(mocks.sharedUpdateBlock).not.toHaveBeenCalled();
      expect(mocks.toast).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not write when canceled", () => {
    open().onClose();
    expect(mocks.updateBlock).not.toHaveBeenCalled();
  });
});
