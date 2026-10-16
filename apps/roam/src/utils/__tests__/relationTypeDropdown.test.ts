// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TLShapeId } from "tldraw";
import { RelationTypeDropdown } from "~/components/canvas/overlays/RelationTypeDropdown";

const mocks = vi.hoisted(() => ({
  types: [] as { id: string; label: string; color: string }[],
  relations: [] as {
    id: string;
    label: string;
    complement: string;
    source: string;
    destination: string;
  }[],
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
vi.mock("~/components/canvas/Tldraw", () => ({
  discourseContext: {
    nodes: {
      "source-type": { text: "Evidence" },
      "target-type": { text: "Claim" },
    },
  },
}));
vi.mock("~/components/canvas/refreshCanvasRelations", () => ({
  refreshCanvasRelations: vi.fn(),
}));
vi.mock("~/utils/createRelationSchema", () => ({
  createRelationSchema: vi.fn(),
}));
vi.mock("~/utils/refreshConfigTree", () => ({ default: vi.fn() }));
vi.mock("~/utils/getDiscourseRelations", () => ({
  default: () => mocks.relations,
}));
vi.mock("~/utils/relationSchemaAcceptance", () => ({
  isAcceptedRelationSchema: () => true,
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

type AddExisting = (args: {
  pair: typeof pair;
  relationType: { label: string; complement: string };
}) => Promise<boolean>;

const render = (props: {
  onAddExisting?: AddExisting;
  onCreateNew?: (p: typeof pair) => void;
  onDismiss?: () => void;
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
  it("shows both actions; Create new gets the node-type pair and Add existing opens the picker", () => {
    const onCreateNew = vi.fn();
    render({ onAddExisting: vi.fn<AddExisting>(), onCreateNew });

    expect(container.textContent).toContain("Relation Type");
    expect(plus()).toBeNull();
    click(button("Create new"));
    expect(onCreateNew).toHaveBeenCalledWith(pair);
    click(button("Add existing…"));
    expect(container.textContent).toContain("Evidence → Claim");
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
    const onCreateNew = vi.fn();
    render({ onAddExisting: vi.fn<AddExisting>(), onCreateNew });

    expect(button("supports")).toBeDefined();
    expect(button("Add existing…")).toBeUndefined();
    click(plus() ?? undefined);
    click(button("Create new"));
    expect(onCreateNew).toHaveBeenCalledWith(pair);
    click(button("Add existing…"));
    expect(container.textContent).toContain("Evidence → Claim");
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

const relation = (
  id: string,
  label: string,
  complement: string,
): (typeof mocks.relations)[number] => ({
  id,
  label,
  complement,
  source: "other",
  destination: "other",
});
const escape = (): void =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });

describe("existing relation picker", () => {
  beforeEach(() => {
    mocks.types = [{ id: "rel-1", label: "supports", color: "#000" }];
    mocks.relations = [
      relation("t1", "supports", "is supported by"),
      relation("t2", "opposes", "is opposed by"),
    ];
  });
  const openPicker = (onAddExisting: AddExisting): void => {
    render({ onAddExisting, onCreateNew: vi.fn() });
    click(plus() ?? undefined);
    click(button("Add existing…"));
  };

  it("lists only types the pair does not already show", () => {
    openPicker(vi.fn<AddExisting>());
    expect(plus()).toBeNull();
    expect(button("opposes / is opposed by")).toBeDefined();
    expect(button("supports / is supported by")).toBeUndefined();
  });

  it("passes the pair and type, then returns to the type list once added", async () => {
    const onAddExisting = vi.fn<AddExisting>().mockResolvedValue(true);
    openPicker(onAddExisting);
    await act(() =>
      Promise.resolve(button("opposes / is opposed by")?.click()),
    );
    expect(onAddExisting).toHaveBeenCalledWith({
      pair,
      relationType: { label: "opposes", complement: "is opposed by" },
    });
    expect(container.textContent).not.toContain("Evidence → Claim");
    expect(button("supports")).toBeDefined();
  });

  it("stays in the picker when adding fails", async () => {
    openPicker(vi.fn<AddExisting>().mockResolvedValue(false));
    await act(() =>
      Promise.resolve(button("opposes / is opposed by")?.click()),
    );
    expect(container.textContent).toContain("Evidence → Claim");
  });

  it("shows an empty message with Create new still reachable", () => {
    mocks.relations = [relation("t1", "supports", "is supported by")];
    openPicker(vi.fn<AddExisting>());
    expect(container.textContent).toContain("No other relation types");
    expect(button("Create new")).toBeDefined();
  });

  it("goes back on the first Escape and closes the menu on the second", () => {
    const onDismiss = vi.fn();
    render({ onAddExisting: vi.fn<AddExisting>(), onDismiss });
    click(plus() ?? undefined);
    click(button("Add existing…"));
    escape();
    expect(container.textContent).not.toContain("Evidence → Claim");
    expect(onDismiss).not.toHaveBeenCalled();
    escape();
    expect(onDismiss).toHaveBeenCalled();
  });

  it("goes back with the back control", () => {
    openPicker(vi.fn<AddExisting>());
    click(
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="Back to relation types"]',
      ) ?? undefined,
    );
    expect(button("supports")).toBeDefined();
  });
});
