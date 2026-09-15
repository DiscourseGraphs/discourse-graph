// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomStylePanel } from "~/components/canvas/CustomStylePanel";

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  autoRelations: vi.fn(),
  createExistingRelations: vi.fn(),
  selected: {
    id: "shape:focal",
    type: "discourse-node",
    props: { uid: "focal", nodeTypeId: "claim" },
  },
  shapes: new Map<
    string,
    { id: string; type: string; props: { uid?: string; nodeTypeId?: string } }
  >(),
  nextId: 0,
}));
vi.mock("tldraw", () => {
  const editor = {
    getOnlySelectedShape: () => mocks.selected,
    getCurrentPageShapes: () => [...mocks.shapes.values()],
    getShape: (id: string) => mocks.shapes.get(id),
    getShapePageBounds: () => ({ minX: 0, maxX: 200, minY: 0, maxY: 100 }),
    getViewportPageBounds: () => ({}),
    getShapeUtil: () => new MockNodeUtil(),
    zoomToBounds: vi.fn(),
    createShapes: (shapes: (typeof mocks.selected)[]) => {
      shapes.forEach((s) => mocks.shapes.set(s.id, s));
      return editor;
    },
    createBindings: vi.fn(),
    deleteShapes: (ids: string[]) => {
      ids.forEach((id) => mocks.shapes.delete(id));
      return editor;
    },
  };
  class MockNodeUtil {
    createExistingRelations = mocks.createExistingRelations;
  }
  return {
    useEditor: () => editor,
    useValue: (_name: string, compute: () => unknown) => compute(),
    useRelevantStyles: () => ({}),
    createShapeId: () => `shape:new-${++mocks.nextId}`,
    Box: { Contains: () => true },
    DefaultStylePanel: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", {}, children ?? "Default styling"),
    DefaultStylePanelContent: () =>
      React.createElement("div", {}, "Native styling controls"),
    MockNodeUtil,
  };
});
vi.mock("~/components/canvas/DiscourseNodeUtil", async () => {
  const { MockNodeUtil } = (await import("tldraw")) as unknown as {
    MockNodeUtil: new () => unknown;
  };
  return {
    DISCOURSE_NODE_SHAPE_TYPE: "discourse-node",
    DiscourseNodeUtil: MockNodeUtil,
    getDiscourseNodeTypeId: ({ shape }: { shape: typeof mocks.selected }) =>
      shape.props.nodeTypeId,
  };
});
vi.mock("~/components/canvas/canvasUtils", () => ({
  getAllRelations: () => [{ id: "supports" }],
  isDiscourseNodeShape: (_editor: unknown, shape: typeof mocks.selected) =>
    shape.type === "discourse-node",
}));
vi.mock("~/utils/getDiscourseContextResults", () => ({
  default: mocks.context,
}));
vi.mock("~/utils/discourseContextMutationRefresh", () => ({
  useDiscourseContextMutationRefresh: vi.fn(),
}));
vi.mock("~/utils/findDiscourseNode", () => ({
  default: () => ({ type: "evidence" }),
}));
vi.mock("~/utils/calcCanvasNodeSizeAndImg", () => ({
  default: () => Promise.resolve({ w: 200, h: 100 }),
}));
vi.mock("~/utils/roamReactComponents", () => ({
  RenderRoamBlockString: ({ string }: { string: string }) =>
    React.createElement("span", {}, string),
}));
vi.mock("~/components/settings/utils/accessors", () => ({
  getPersonalSetting: mocks.autoRelations,
}));
vi.mock(
  "~/components/canvas/DiscourseRelationShape/DiscourseRelationUtil",
  () => ({ getRelationColor: () => "blue" }),
);
vi.mock("~/components/canvas/DiscourseRelationShape/helpers", () => ({
  getParallelArrowBend: () => ({ bend: 0 }),
}));
vi.mock("~/components/canvas/ToastListener", () => ({
  dispatchToastEvent: vi.fn(),
}));
vi.mock("roamjs-components/components/ExtensionApiContext", () => ({
  useExtensionAPI: () => ({}),
}));
vi.mock("roamjs-components/queries/getPageTitleByPageUid", () => ({
  default: () => "Related evidence",
}));

let root: Root;
let container: HTMLDivElement;
const render = async (): Promise<void> => {
  await act(async () => {
    root.render(React.createElement(CustomStylePanel));
    await Promise.resolve();
  });
};
const click = async (selector: string): Promise<void> => {
  const element = container.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing control: ${selector}`);
  await act(async () => {
    element.click();
    await Promise.resolve();
  });
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.selected = {
    id: "shape:focal",
    type: "discourse-node",
    props: { uid: "focal", nodeTypeId: "claim" },
  };
  mocks.shapes.clear();
  mocks.shapes.set(mocks.selected.id, mocks.selected);
  mocks.nextId = 0;
  mocks.context.mockResolvedValue([
    {
      label: "Supported By",
      results: {
        evidence: { text: "Related evidence", id: "supports", complement: 1 },
      },
    },
  ]);
  mocks.autoRelations.mockReturnValue(false);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("node card panel", () => {
  it("opens Context and switches to the existing Styling controls", async () => {
    await render();
    expect(container.textContent).toContain("Supported By");
    expect(container.textContent).toContain("[[Related evidence]]");
    await click('[data-tab-id="styling"]');
    expect(container.textContent).toContain("Native styling controls");
    await click('[data-tab-id="context"]');
    expect(container.textContent).toContain("Supported By");
  });
  it.each(["page-node", "blck-node"])(
    "keeps default styling for %s",
    async (nodeTypeId) => {
      mocks.selected.props.nodeTypeId = nodeTypeId;
      await render();
      expect(container.textContent).toBe("Default styling");
      expect(mocks.context).not.toHaveBeenCalled();
    },
  );
  it("adds and removes the related node while preserving its context row", async () => {
    await render();
    await click('button[title="Add node to canvas"]');
    expect(
      [...mocks.shapes.values()].some((s) => s.props.uid === "evidence"),
    ).toBe(true);
    await click('button[title="Remove node from canvas"]');
    expect(
      [...mocks.shapes.values()].some((s) => s.props.uid === "evidence"),
    ).toBe(false);
    expect(container.textContent).toContain("Related evidence");
    expect(mocks.createExistingRelations).not.toHaveBeenCalled();
  });
  it("uses automatic relation creation only when enabled", async () => {
    mocks.autoRelations.mockReturnValue(true);
    await render();
    await click('button[title="Add node to canvas"]');
    expect(mocks.createExistingRelations).toHaveBeenCalledOnce();
  });
});
