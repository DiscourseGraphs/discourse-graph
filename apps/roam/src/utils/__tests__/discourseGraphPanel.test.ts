// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DiscourseGraphPanel from "~/components/canvas/DiscourseToolPanel";
import {
  DISCOURSE_GRAPH_PROP_NAME,
  IMPORTED_FROM_PROP_KEY,
} from "~/utils/createReifiedBlock";
import { acceptImportedRelationSchema } from "~/utils/relationSchemaAcceptance";
import { markRelationSchemaDeleted } from "~/utils/relationSchemaChanges";
import type { json } from "~/utils/getBlockProps";

const mocks = vi.hoisted(() => ({
  props: new Map<string, Record<string, json>>(),
  discourseContext: {
    nodes: {},
    relations: {},
  },
}));
vi.mock("tldraw", () => {
  const editor = {
    getCurrentToolId: () => "discourse-tool",
    getZoomLevel: () => 1,
    setCurrentTool: vi.fn(),
  };
  return {
    useEditor: () => editor,
    useValue: (_name: string, compute: () => unknown) => compute(),
    useQuickReactor: vi.fn(),
    createShapeId: vi.fn(),
    Vec: class {},
    Box: class {},
    FONT_FAMILIES: { sans: "sans" },
  };
});
vi.mock("@tldraw/state-react", () => ({
  useAtom: (_name: string, initial: () => unknown) => {
    const value = initial();
    return { get: () => value, set: vi.fn() };
  },
}));
vi.mock("~/components/canvas/Tldraw", () => ({
  DEFAULT_WIDTH: 160,
  DEFAULT_HEIGHT: 64,
  discourseContext: mocks.discourseContext,
}));
vi.mock("~/components/canvas/DiscourseNodeUtil", () => ({
  DiscourseNodeUtil: class {},
  DEFAULT_STYLE_PROPS: {},
  DISCOURSE_NODE_SHAPE_TYPE: "discourse-node",
  FONT_SIZES: { s: 12 },
}));
vi.mock(
  "~/components/canvas/DiscourseRelationShape/DiscourseRelationUtil",
  () => ({ getRelationColor: () => "black" }),
);
vi.mock("~/components/settings/DiscourseNodeCanvasSettings", () => ({
  formatHexColor: () => "",
}));
vi.mock("~/utils/getDiscourseNodeColors", () => ({
  getDiscourseNodeColors: () => ({ backgroundColor: "", textColor: "" }),
}));
vi.mock("~/icons", () => ({
  TOOL_ARROW_ICON_SVG: "<svg></svg>",
  NODE_COLOR_ICON_SVG: "<svg></svg>",
}));
vi.mock("~/utils/internalError", () => ({ default: vi.fn() }));

const importedFrom = {
  [IMPORTED_FROM_PROP_KEY]: {
    sourceNodeRid: "orn:obsidian.schema:vault/relation",
    sourceModifiedAt: "2026-08-01T00:00:00.000Z",
  },
};

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  mocks.props.clear();
  mocks.props.set("imported-supports", {
    [DISCOURSE_GRAPH_PROP_NAME]: importedFrom,
  });
  mocks.discourseContext.relations = {
    opposes: [{ id: "local-opposes" }],
    supports: [{ id: "imported-supports" }],
  };
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(window, {
    roamAlphaAPI: {
      pull: (_pattern: string, [, uid]: [string, string]) => ({
        ":block/props": mocks.props.get(uid) ?? {},
      }),
      data: {
        block: {
          update: ({
            block,
          }: {
            block: { uid: string; props: Record<string, json> };
          }) => {
            mocks.props.set(block.uid, block.props);
            return Promise.resolve();
          },
        },
      },
    },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const listedRelations = (): string[] =>
  [...container.querySelectorAll("[data-drag_item_index] > span:last-child")]
    .map((span) => span.textContent ?? "")
    .filter((text) => text in mocks.discourseContext.relations);

it("refilters relation tools itself when a schema is accepted or deleted", async () => {
  await act(() => {
    root.render(
      React.createElement(DiscourseGraphPanel, {
        nodes: [],
        relations: ["opposes", "supports"],
      }),
    );
    return Promise.resolve();
  });
  expect(listedRelations()).toEqual(["opposes"]);

  await act(async () => {
    await acceptImportedRelationSchema("imported-supports");
  });
  expect(listedRelations()).toEqual(["opposes", "supports"]);

  act(() => {
    markRelationSchemaDeleted("imported-supports");
  });
  expect(listedRelations()).toEqual(["opposes"]);
});
