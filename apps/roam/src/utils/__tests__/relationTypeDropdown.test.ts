// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TLShapeId } from "tldraw";
import { RelationTypeDropdown } from "~/components/canvas/overlays/RelationTypeDropdown";

const mocks = vi.hoisted(() => ({
  types: [] as { id: string; label: string; color: string }[],
}));
vi.mock("tldraw", () => ({
  useEditor: () => ({
    getShape: (id: string) => ({ id, type: `${id}-type`, props: {} }),
  }),
}));
vi.mock("~/components/canvas/DiscourseNodeUtil", () => ({
  getDiscourseNodeTypeId: ({ shape }: { shape: { type: string } }) =>
    shape.type,
}));
vi.mock("~/components/canvas/overlays/relationCreation", () => ({
  getValidRelationTypesBetween: () => mocks.types,
}));

const pair = { sourceType: "source-type", targetType: "target-type" };
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.types = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const render = (props: {
  onAddExisting?: (p: typeof pair) => void;
  onCreateNew?: (p: typeof pair) => void;
}): void =>
  act(() =>
    root.render(
      React.createElement(RelationTypeDropdown, {
        sourceId: "source" as TLShapeId,
        targetId: "target" as TLShapeId,
        dropdownPos: { x: 0, y: 0 },
        onSelect: vi.fn(),
        onDismiss: vi.fn(),
        ...props,
      }),
    ),
  );
const button = (text: string): HTMLButtonElement | undefined =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === text);
const click = (el: HTMLElement | undefined): void => act(() => el?.click());
const plus = (): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>(
    'button[aria-label="Add relation type"]',
  );

describe("empty state", () => {
  it("shows both actions and calls each with the node-type pair", () => {
    const onAddExisting = vi.fn();
    const onCreateNew = vi.fn();
    render({ onAddExisting, onCreateNew });

    expect(container.textContent).toContain("Relation Type");
    expect(plus()).toBeNull();
    click(button("Add existing…"));
    click(button("Create new"));
    expect(onAddExisting).toHaveBeenCalledWith(pair);
    expect(onCreateNew).toHaveBeenCalledWith(pair);
  });

  it("hides actions without handlers but still renders the menu", () => {
    render({});
    expect(button("Add existing…")).toBeUndefined();
    expect(button("Create new")).toBeUndefined();
    expect(container.textContent).toContain(
      "No relation types between these nodes",
    );
  });
});

describe("populated state", () => {
  beforeEach(() => {
    mocks.types = [{ id: "rel-1", label: "supports", color: "#000" }];
  });

  it("exposes both actions through the + control", () => {
    const onAddExisting = vi.fn();
    const onCreateNew = vi.fn();
    render({ onAddExisting, onCreateNew });

    expect(button("supports")).toBeDefined();
    expect(button("Add existing…")).toBeUndefined();
    click(plus() ?? undefined);
    click(button("Add existing…"));
    click(button("Create new"));
    expect(onAddExisting).toHaveBeenCalledWith(pair);
    expect(onCreateNew).toHaveBeenCalledWith(pair);
  });

  it("opens the actions in a popover beside the menu, not inside it", () => {
    render({ onAddExisting: vi.fn(), onCreateNew: vi.fn() });
    click(plus() ?? undefined);

    const menu = button("supports")?.closest(".overflow-y-auto");
    expect(menu).toBeTruthy();
    expect(menu?.contains(button("Add existing…") ?? null)).toBe(false);
    expect(menu?.contains(button("Create new") ?? null)).toBe(false);
  });

  it("renders only the action whose handler is passed", () => {
    render({ onCreateNew: vi.fn() });
    click(plus() ?? undefined);
    expect(button("Create new")).toBeDefined();
    expect(button("Add existing…")).toBeUndefined();
  });

  it("hides the + control without handlers", () => {
    render({});
    expect(plus()).toBeNull();
  });
});
