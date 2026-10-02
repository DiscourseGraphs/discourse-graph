// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StoredRelationsWarning from "~/components/StoredRelationsWarning";
import { ROAM_DOCS } from "~/components/settings/utils/docs";
import { getStoredRelationsEnabled } from "~/utils/storedRelations";

vi.mock("~/utils/storedRelations", () => ({
  getStoredRelationsEnabled: vi.fn(),
}));

let root: Root;
let container: HTMLDivElement;
const render = (): void => {
  act(() => root.render(React.createElement(StoredRelationsWarning)));
};

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("stored relations warning", () => {
  it("warns and links the migration guide while stored relations are disabled", () => {
    vi.mocked(getStoredRelationsEnabled).mockReturnValue(false);
    render();
    expect(container.textContent).toContain("Stored relations are disabled");
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      ROAM_DOCS.migrationToStoredRelations,
    );
  });

  it("removes the warning once stored relations are enabled", () => {
    vi.mocked(getStoredRelationsEnabled).mockReturnValue(false);
    render();
    vi.mocked(getStoredRelationsEnabled).mockReturnValue(true);
    render();
    expect(container.innerHTML).toBe("");
  });
});
