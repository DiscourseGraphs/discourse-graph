// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingItemRow from "~/components/settings/components/SettingItemRow";
import { ROAM_DOCS_ASSETS } from "~/components/settings/utils/docs";
import { PERSONAL_KEYS } from "~/components/settings/utils/settingKeys";

vi.mock("~/utils/getDiscourseNodes", () => ({ default: vi.fn(() => []) }));
vi.mock("~/utils/getDiscourseRelations", () => ({ default: vi.fn(() => []) }));

describe("SettingItemRow example", () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = (props: React.ComponentProps<typeof SettingItemRow>): void => {
    act(() => root.render(React.createElement(SettingItemRow, props)));
  };

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

  const overlayRow = {
    label: "Overlay",
    settingKeys: [PERSONAL_KEYS.discourseContextOverlay],
    control: React.createElement("input"),
  };
  const trigger = (): HTMLElement | undefined =>
    [...container.querySelectorAll<HTMLElement>("a[role='button']")].find(
      (el) => el.textContent === "Show example",
    );
  const hoverTrigger = (): void => {
    act(() => {
      trigger()!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      vi.advanceTimersByTime(500);
    });
  };

  it("offers the Overlay example behind a hover, loading the docs-site image only once opened", () => {
    vi.useFakeTimers();
    render(overlayRow);
    expect(trigger()).toBeDefined();
    expect(document.querySelector("img")).toBeNull();
    hoverTrigger();
    const img = document.querySelector("img");
    expect(img?.getAttribute("src")).toBe(
      ROAM_DOCS_ASSETS.discourseContextOverlay,
    );
    expect(img?.getAttribute("alt")).toBeTruthy();
    vi.useRealTimers();
  });

  it("falls back to the alt text when the image cannot load", () => {
    vi.useFakeTimers();
    render(overlayRow);
    hoverTrigger();
    const img = document.querySelector("img")!;
    const alt = img.getAttribute("alt")!;
    act(() => {
      img.dispatchEvent(new Event("error"));
    });
    expect(document.querySelector("img")).toBeNull();
    expect(document.body.textContent).toContain(alt);
    vi.useRealTimers();
  });

  it("leaves keyboard focus on the trigger when the preview opens", () => {
    vi.useFakeTimers();
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    render(overlayRow);
    act(() => {
      trigger()!.focus();
      vi.advanceTimersByTime(500);
    });
    act(() => frames.splice(0).forEach((cb) => cb(0)));
    expect(document.querySelector("img")).not.toBeNull();
    expect(document.activeElement).toBe(trigger());
    vi.useRealTimers();
  });

  it("renders no preview for a setting without an example", () => {
    render({
      label: "Plain",
      description: "No example here.",
      settingKeys: ["not-in-catalog"],
      control: React.createElement("input"),
    });
    expect(trigger()).toBeUndefined();
  });

  it("skips the example on the inline variant", () => {
    render({
      label: "Overlay",
      settingKeys: [PERSONAL_KEYS.discourseContextOverlay],
      control: React.createElement("input"),
      inline: true,
    });
    expect(trigger()).toBeUndefined();
  });
});
