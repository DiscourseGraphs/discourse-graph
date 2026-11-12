// @vitest-environment jsdom
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import ModifyNodeDialog from "~/components/ModifyNodeDialog";

const mocks = vi.hoisted(() => ({
  format: vi.fn(),
  pull: vi.fn(),
}));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("~/utils/fireQuery", () => ({ default: () => Promise.resolve([]) }));
vi.mock("~/utils/getAllDiscourseNodesSince", () => ({
  getAllDiscourseNodesSince: () => Promise.resolve([]),
}));
vi.mock("~/utils/resolveQueryBuilderRef", () => ({ default: vi.fn() }));
vi.mock("~/utils/runQuery", () => ({ default: vi.fn() }));
vi.mock("~/utils/createDiscourseNode", () => ({ default: vi.fn() }));
vi.mock("roamjs-components/components/Toast", () => ({ render: vi.fn() }));
vi.mock("roamjs-components/components/MenuItemSelect", () => ({
  default: () => null,
}));
vi.mock("~/components/FuzzySelectInput", () => ({ default: () => null }));
vi.mock("~/utils/getDiscourseNodes", () => ({
  default: () => [
    { type: "evidence", text: "Evidence", format: "{content} - {Source}" },
  ],
  excludeDefaultNodes: () => true,
}));
vi.mock("~/utils/formatUtils", () => ({
  getNewDiscourseNodeText: mocks.format,
  getReferencedNodeInFormat: () => ({ type: "source", text: "Source" }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it.each([
  ["page", { ":node/title": "@Source" }, "Selected - [[@Source]]"],
  ["block", { ":block/string": "@Source" }, "Selected - @Source"],
])(
  "preserves the existing %s reference when confirming",
  async (_, entity, title) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    window.roamAlphaAPI = {
      pull: mocks.pull,
      util: { generateUID: () => "query-uid" },
    } as unknown as typeof window.roamAlphaAPI;
    mocks.pull.mockReturnValue(entity);
    const create = vi.fn().mockResolvedValue("new-page");
    const success = vi.fn().mockResolvedValue(undefined);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        await Promise.resolve();
        root.render(
          React.createElement(ModifyNodeDialog, {
            isOpen: true,
            onClose: vi.fn(),
            onSuccess: success,
            createOverride: create,
            mode: "create",
            nodeType: "evidence",
            initialValue: { text: "Selected", uid: "" },
            initialReferencedNode: { text: "@Source", uid: "existing-source" },
          }),
        );
      });
      const confirm = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent === "Confirm",
      );
      expect(confirm).toBeDefined();
      expect(confirm?.disabled).toBe(false);
      await act(async () => {
        confirm?.click();
        await Promise.resolve();
      });
      expect(mocks.format).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledWith({
        formattedTitle: title,
        configPageUid: "evidence",
      });
      expect(success).toHaveBeenCalledWith(
        expect.objectContaining({ text: title }),
      );
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  },
);
