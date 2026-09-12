// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TentativeRelationInstances from "~/components/TentativeRelationInstances";
import { getTentativeRelationInstances } from "~/utils/tentativeRelations";
import { getStoredRelationsEnabled } from "~/utils/storedRelations";
import internalError from "~/utils/internalError";

vi.mock("~/utils/tentativeRelations", () => ({
  getTentativeRelationInstances: vi.fn(),
}));
vi.mock("~/utils/storedRelations", () => ({
  getStoredRelationsEnabled: vi.fn(),
}));
vi.mock("~/utils/internalError", () => ({ default: vi.fn() }));
vi.mock("~/utils/getDiscourseRelations", () => ({ default: () => [] }));
vi.mock("~/utils/materializeSharedNode", () => ({ getErrorMessage: String }));
vi.mock("~/utils/createReifiedBlock", () => ({
  acceptTentativeRelationInstance: vi.fn(),
}));
vi.mock("roamjs-components/queries/getPageTitleByPageUid", () => ({
  default: (uid: string) => uid,
}));
vi.mock("roamjs-components/writes/deleteBlock", () => ({ default: vi.fn() }));
vi.mock("roamjs-components/components/Toast", () => ({ render: vi.fn() }));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

let root: Root;
let container: HTMLDivElement;
const onCountChange = vi.fn();
const render = async (): Promise<void> => {
  await act(async () => {
    root.render(
      React.createElement(TentativeRelationInstances, {
        uid: "node",
        onCountChange,
      }),
    );
    await Promise.resolve();
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(getStoredRelationsEnabled).mockReturnValue(true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("pending relation loading", () => {
  it("reports loading until the query establishes that no relations exist", async () => {
    let finish: (() => void) | undefined;
    vi.mocked(getTentativeRelationInstances).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve([]);
        }),
    );
    await render();
    expect(onCountChange).toHaveBeenCalledExactlyOnceWith(undefined);
    await act(async () => {
      finish?.();
      await Promise.resolve();
    });
    expect(onCountChange).toHaveBeenLastCalledWith(0);
    expect(internalError).not.toHaveBeenCalled();
  });

  it("reports a failed load without claiming the relation set is empty", async () => {
    const error = new Error("graph query failed");
    vi.mocked(getTentativeRelationInstances).mockRejectedValue(error);
    await render();
    expect(onCountChange).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(internalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        userMessage:
          "Could not load imported relations. Refresh and try again.",
      }),
    );
  });

  it("settles to zero without querying when stored relations are disabled", async () => {
    vi.mocked(getStoredRelationsEnabled).mockReturnValue(false);
    await render();
    expect(onCountChange).toHaveBeenCalledExactlyOnceWith(0);
    expect(getTentativeRelationInstances).not.toHaveBeenCalled();
  });
});
