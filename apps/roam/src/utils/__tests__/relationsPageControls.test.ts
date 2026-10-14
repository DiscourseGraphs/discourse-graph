// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RelationsPage from "~/components/RelationsPage";
import { type RelationRow } from "~/components/relationsPageData";

const state = vi.hoisted(() => ({ rows: [] as RelationRow[] }));
vi.mock("~/utils/getDiscourseNodes", () => ({ default: () => [] }));
vi.mock("~/utils/getDiscourseRelations", () => ({ default: () => [] }));
vi.mock("~/components/useRelationRows", () => ({
  useRelationRows: () => ({
    rows: state.rows,
    loading: false,
    error: false,
    refresh: vi.fn(),
  }),
}));
vi.mock("~/utils/roamReactComponents", () => ({
  RenderRoamBlockString: ({ string }: { string: string }) => string,
}));
let root: Root;
let container: HTMLDivElement;
const render = (): void => {
  act(() =>
    root.render(
      React.createElement(RelationsPage, {
        pageUid: "storage",
        onRowsLoaded: vi.fn(),
        onVisibilityChange: vi.fn(),
      }),
    ),
  );
};
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  root = createRoot(container);
  HTMLElement.prototype.scrollTo = vi.fn();
  const endpoint = {
    uid: "a",
    text: "Endpoint",
    exists: true,
    isPage: false,
    typeId: "type",
    typeLabel: "Type",
  };
  state.rows = Array.from({ length: 125 }, (_, i) => ({
    uid: String(i),
    type: "Informs",
    schemaUid: "schema",
    typeKnown: true,
    source: endpoint,
    destination: endpoint,
    tentative: false,
    createdAt: 1,
    props: {},
  }));
});
afterEach(() => act(() => root.unmount()));

it("stays on the clamped page after deleted relations are restored", () => {
  render();
  const next = container.querySelector<HTMLButtonElement>(
    '[aria-label="Next relations"]',
  )!;
  act(() => Simulate.click(next));
  expect(container.textContent).toContain("26–50 of 125");
  const all = state.rows;
  state.rows = all.slice(0, 20);
  render();
  expect(container.textContent).toContain("1–20 of 20");
  state.rows = all;
  render();
  expect(container.textContent).toContain("1–25 of 125");
});

it("caps rendering at 100 results and restores the capped input on blur", () => {
  render();
  const input = container.querySelector<HTMLInputElement>(
    '[aria-label="Results per page"]',
  )!;
  expect(input.max).toBe("100");
  act(() => {
    input.value = "1000";
    Simulate.change(input);
  });
  expect(container.querySelectorAll(".dg-relation-row")).toHaveLength(100);
  act(() => Simulate.blur(input));
  expect(input.value).toBe("100");
});
