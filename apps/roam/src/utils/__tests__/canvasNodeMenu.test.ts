// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NodeMenu from "~/components/DiscourseNodeMenu";
import type { OnloadArgs } from "roamjs-components/types";

const { updateBlock, onTagAdded } = vi.hoisted(() => ({
  updateBlock: vi.fn(),
  onTagAdded: vi.fn(),
}));
vi.mock("roamjs-components/writes/updateBlock", () => ({
  default: updateBlock,
}));
vi.mock("roamjs-components/queries/getTextByBlockUid", () => ({
  default: () => "A canvas block",
}));
vi.mock("roamjs-components/components/CursorMenu", () => ({
  getCoordsFromTextarea: vi.fn(),
}));
vi.mock("~/utils/getDiscourseNodes", () => ({
  default: () => [
    {
      type: "claim",
      text: "Claim",
      tag: "claim",
      shortcut: "C",
      backedBy: "user",
    },
  ],
}));
vi.mock("~/utils/createDiscourseNode", () => ({ default: vi.fn() }));
vi.mock("~/components/ModifyNodeDialog", () => ({ default: vi.fn() }));
vi.mock("roamjs-components/util/createOverlayRender", () => ({
  default: () => vi.fn(),
}));
vi.mock("roamjs-components/util/extensionApiContext", () => ({
  default: vi.fn(),
}));
vi.mock("~/components/settings/DiscourseNodeCanvasSettings", () => ({
  formatHexColor: () => "#000000",
}));
vi.mock("~/components/settings/utils/accessors", () => ({
  setPersonalSetting: vi.fn(),
}));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

let container: HTMLDivElement;
let root: Root;
const onCanvasPointerDown = vi.fn();
const onClose = vi.fn();

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      React.createElement(
        "div",
        { onPointerDown: onCanvasPointerDown },
        React.createElement(NodeMenu, {
          blockUid: "block-uid",
          extensionAPI: {} as OnloadArgs["extensionAPI"],
          trigger: React.createElement("button", null, "Add tag"),
          defaultIsOpen: true,
          onClose,
          onTagAdded,
        }),
      ),
    );
  });
});
afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("canvas node menu", () => {
  it("keeps a portaled mouse selection out of canvas pointer capture and refreshes after the write", async () => {
    let finishUpdate: () => void = () => {};
    updateBlock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishUpdate = resolve;
        }),
    );
    const menuItem = document.querySelector<HTMLElement>(".bp3-menu-item");
    expect(menuItem).not.toBeNull();
    act(() => {
      menuItem!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      menuItem!.click();
    });
    expect(onCanvasPointerDown).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(updateBlock).toHaveBeenCalledExactlyOnceWith({
      uid: "block-uid",
      text: "A canvas block #claim",
    });
    expect(onTagAdded).not.toHaveBeenCalled();
    await act(async () => {
      finishUpdate();
      await Promise.resolve();
    });
    expect(onTagAdded).toHaveBeenCalledExactlyOnceWith("A canvas block #claim");
    expect(onClose).toHaveBeenCalled();
  });

  it("still selects tags using the keyboard", async () => {
    updateBlock.mockResolvedValue(undefined);
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(updateBlock).toHaveBeenCalledExactlyOnceWith({
      uid: "block-uid",
      text: "A canvas block #claim",
    });
    expect(onTagAdded).toHaveBeenCalledExactlyOnceWith("A canvas block #claim");
  });
});
