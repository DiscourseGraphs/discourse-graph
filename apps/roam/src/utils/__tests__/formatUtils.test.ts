import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveNewDiscourseNodeText } from "~/utils/formatUtils";
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
