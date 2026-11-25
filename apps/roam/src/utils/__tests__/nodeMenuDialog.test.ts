// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import NodeMenu, {
  TextSelectionNodeMenu,
} from "~/components/DiscourseNodeMenu";
import type { OnloadArgs } from "roamjs-components/types";
import type { openCreateNodeDialogAtRange } from "~/utils/openCreateNodeDialogAtRange";

const mocks = vi.hoisted(() => ({
  open: vi.fn<typeof openCreateNodeDialogAtRange>(),
  capture: vi.fn(),
  resolve: vi.fn(),
  close: vi.fn(),
}));
vi.mock("posthog-js", () => ({ default: { capture: mocks.capture } }));
vi.mock("~/utils/openCreateNodeDialogAtRange", () => ({
  openCreateNodeDialogAtRange: mocks.open,
}));
vi.mock("~/utils/resolveInitialReferencedNode", () => ({
  resolveInitialReferencedNode: mocks.resolve,
}));
vi.mock("roamjs-components/dom/getUids", () => ({
  default: () => ({ blockUid: "origin", windowId: "sidebar" }),
}));
vi.mock("roamjs-components/components/CursorMenu", () => ({
  getCoordsFromTextarea: vi.fn(),
}));
vi.mock("~/utils/getDiscourseNodes", () => ({
  default: () => [
    {
      type: "evidence",
      text: "Evidence",
      shortcut: "E",
      backedBy: "user",
      format: "{content} - {Source}",
      canvasSettings: {},
    },
  ],
}));
vi.mock("~/utils/formatUtils", () => ({
  getReferencedNodeInFormat: () => ({
    type: "source",
    text: "Source",
    format: "@{content}",
  }),
  resolveNewDiscourseNodeText: vi.fn(),
  insertTagIntoText: vi.fn(),
}));
vi.mock("~/utils/createDiscourseNode", () => ({ default: vi.fn() }));
vi.mock("~/components/settings/DiscourseNodeCanvasSettings", () => ({
  formatHexColor: () => "#000000",
}));
vi.mock("~/components/settings/utils/accessors", () => ({
  setPersonalSetting: vi.fn(),
}));

let container: HTMLDivElement;
let textarea: HTMLTextAreaElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  mocks.resolve.mockResolvedValue({ text: "@Source", uid: "source-uid" });
  container = document.createElement("div");
  textarea = document.createElement("textarea");
  textarea.value = "Before selected after";
  document.body.append(container, textarea);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  textarea.remove();
  vi.unstubAllGlobals();
});

it.each([
  [7, 15],
  [7, 7],
])(
  "routes textarea range %i..%i through the existing dialog",
  async (start, end) => {
    textarea.setSelectionRange(start, end);
    await act(async () => {
      await Promise.resolve();
      root.render(
        React.createElement(NodeMenu, {
          textarea,
          extensionAPI: {} as OnloadArgs["extensionAPI"],
          onClose: mocks.close,
          isShift: true,
        }),
      );
    });
    await act(async () => {
      await Promise.resolve();
      document.querySelector<HTMLElement>(".bp3-menu-item[data-node]")!.click();
    });
    expect(mocks.resolve).toHaveBeenCalledWith({
      blockUid: "origin",
      referencedNodeType: {
        type: "source",
        text: "Source",
        format: "@{content}",
      },
    });
    expect(mocks.open).toHaveBeenCalledWith(
      expect.objectContaining({
        blockUid: "origin",
        windowId: "sidebar",
        selectionStart: start,
        selectionEnd: end,
        originalText: "Before selected after",
        initialReferencedNode: { text: "@Source", uid: "source-uid" },
      }),
    );
    expect(mocks.close).toHaveBeenCalled();
    mocks.open.mock.calls[0][0].onInserted?.({
      text: "changed node",
      uid: "new-node",
      action: "create",
      nodeType: "claim",
    });
    expect(mocks.capture).toHaveBeenCalledWith(
      "Discourse Node: Created via Node Menu",
      { text: "changed node", nodeType: "claim" },
    );
  },
);

it("routes the text-selection popup through the same reference-prefilled dialog", async () => {
  textarea.setSelectionRange(7, 15);
  await act(async () => {
    await Promise.resolve();
    root.render(
      React.createElement(TextSelectionNodeMenu, {
        textarea,
        extensionAPI: {} as OnloadArgs["extensionAPI"],
        onClose: mocks.close,
      }),
    );
  });
  await act(async () => {
    await Promise.resolve();
    container.querySelector<HTMLButtonElement>("button")!.click();
  });
  await act(async () => {
    await Promise.resolve();
    document.querySelector<HTMLElement>(".bp3-menu-item[data-node]")!.click();
  });
  expect(mocks.open).toHaveBeenCalledWith(
    expect.objectContaining({
      selectionStart: 7,
      selectionEnd: 15,
      initialReferencedNode: { text: "@Source", uid: "source-uid" },
    }),
  );
});
