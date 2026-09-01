import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  insertTagIntoText,
  resolveNewDiscourseNodeText,
} from "~/utils/formatUtils";
import type { ModifyNodeDialogProps } from "~/components/ModifyNodeDialog";

const { renderFormDialog } = vi.hoisted(() => ({
  renderFormDialog: vi.fn<(props: ModifyNodeDialogProps) => void>(),
}));

vi.mock("roamjs-components/util/createOverlayRender", () => ({
  default: () => renderFormDialog,
}));
vi.mock("roamjs-components/util/extensionApiContext", () => ({
  default: vi.fn(() => undefined),
}));
vi.mock("~/components/ModifyNodeDialog", () => ({
  default: vi.fn(),
}));
vi.mock("~/utils/getDiscourseNodes", () => ({
  default: vi.fn(() => []),
}));

describe("resolveNewDiscourseNodeText", () => {
  beforeEach(() => {
    renderFormDialog.mockReset();
  });

  it("reports when an empty selection is handled by the creation dialog", async () => {
    const resultPromise = resolveNewDiscourseNodeText({
      text: "",
      nodeType: "issue",
      blockUid: "source-block",
      skipBlockUpdate: true,
    });
    const dialogProps = renderFormDialog.mock.calls[0][0];

    await dialogProps.onSuccess({
      text: "Test issue",
      uid: "test-issue-uid",
      action: "create",
    });
    dialogProps.onClose();

    await expect(resultPromise).resolves.toEqual({
      text: "Test issue",
      handledByDialog: true,
    });
  });
});

describe("insertTagIntoText", () => {
  it("appends the tag with a leading space at the end of the text", () => {
    expect(
      insertTagIntoText({
        text: "some block",
        tag: "Claim",
        selectionStart: "some block".length,
      }),
    ).toBe("some block #Claim");
  });

  it("inserts the tag without a leading space when the text is empty", () => {
    expect(
      insertTagIntoText({ text: "", tag: "Claim", selectionStart: 0 }),
    ).toBe("#Claim");
  });

  it("inserts the tag at the cursor position inside the text", () => {
    expect(
      insertTagIntoText({
        text: "before after",
        tag: "Evidence",
        selectionStart: "before".length,
      }),
    ).toBe("before #Evidence after");
  });
});
