// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsGroup } from "~/components/settings/components/SettingsHeadings";
import {
  NODE_CONFIG_SECTIONS,
  getNodeConfigSections,
  toggleAllSections,
  toggleSection,
} from "~/components/settings/utils/nodeConfigSections";

describe("node config sections", () => {
  it("lists Suggestive mode only when sync is enabled", () => {
    expect(getNodeConfigSections({ isSyncEnabled: false })).not.toContain(
      NODE_CONFIG_SECTIONS.suggestiveMode,
    );
    expect(getNodeConfigSections({ isSyncEnabled: true })).toContain(
      NODE_CONFIG_SECTIONS.suggestiveMode,
    );
  });

  it("toggles one section without touching the others", () => {
    const collapsed = toggleSection(new Set(["Legacy"]), "Canvas");
    expect([...collapsed].sort()).toEqual(["Canvas", "Legacy"]);
    expect([...toggleSection(collapsed, "Legacy")]).toEqual(["Canvas"]);
  });

  it("collapses every visible section while any is open, then expands them all", () => {
    const sections = getNodeConfigSections({ isSyncEnabled: false });
    const collapsed = toggleAllSections(new Set(["Legacy"]), sections);
    expect([...collapsed].sort()).toEqual([...sections].sort());
    expect(toggleAllSections(collapsed, sections).size).toBe(0);
  });

  it("treats a stale hidden section as irrelevant to collapse all", () => {
    const sections = getNodeConfigSections({ isSyncEnabled: false });
    const collapsed = new Set([
      ...sections,
      NODE_CONFIG_SECTIONS.suggestiveMode,
    ]);
    expect(toggleAllSections(collapsed, sections).size).toBe(0);
  });
});

describe("SettingsGroup", () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = (isOpen: boolean, onToggle = vi.fn()): void => {
    act(() =>
      root.render(
        React.createElement(SettingsGroup, {
          title: "Canvas",
          collapsible: { isOpen, onToggle },
          children: React.createElement(
            "div",
            { "data-setting-id": "row" },
            "Row",
          ),
        }),
      ),
    );
  };
  const heading = (): HTMLElement =>
    container.querySelector<HTMLElement>("[role='button']")!;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("keeps collapsed rows mounted but hidden, so search anchors still resolve", () => {
    render(false);
    const content = document.getElementById(
      heading().getAttribute("aria-controls")!,
    )!;
    expect(heading().getAttribute("aria-expanded")).toBe("false");
    expect(content.className).toBe("hidden");
    expect(container.querySelector("[data-setting-id='row']")).not.toBeNull();
  });

  it("toggles from click, Enter and Space", () => {
    const onToggle = vi.fn();
    render(true, onToggle);
    act(() => heading().click());
    for (const key of ["Enter", " "]) {
      act(() => {
        heading().dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true }),
        );
      });
    }
    expect(onToggle).toHaveBeenCalledTimes(3);
  });

  it("renders a plain heading when not collapsible", () => {
    act(() =>
      root.render(
        React.createElement(SettingsGroup, {
          title: "Node trigger",
          children: "Row",
        }),
      ),
    );
    expect(heading()).toBeNull();
    expect(container.textContent).toContain("Node trigger");
  });
});
