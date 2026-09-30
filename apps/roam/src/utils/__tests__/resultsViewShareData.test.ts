// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { Dialog, Popover } from "@blueprintjs/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ResultsView from "~/components/results-view/ResultsView";

vi.mock("~/components/Export", () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    React.createElement(
      Dialog,
      {
        isOpen,
        title: "Share Query Results",
        autoFocus: false,
        enforceFocus: false,
      },
      React.createElement("input", { "aria-label": "Filename" }),
      React.createElement("button", { onClick: onClose }, "Cancel"),
    ),
}));
vi.mock("~/components/results-view/Charts", () => ({ default: () => null }));
vi.mock("~/components/results-view/Timeline", () => ({ default: () => null }));
vi.mock("~/components/results-view/Kanban", () => ({ default: () => null }));
vi.mock("~/components/results-view/ResultsTable", () => ({
  default: () => null,
}));
vi.mock("~/components/results-view/Inputs", () => ({ Inputs: () => null }));
vi.mock("~/utils/parseQuery", () => ({ default: vi.fn() }));
vi.mock("~/utils/fireQuery", () => ({ getDatalogQuery: vi.fn() }));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("roamjs-components/components/ExtensionApiContext", () => ({
  useExtensionAPI: () => ({ settings: { get: () => undefined } }),
}));
vi.mock("~/utils/parseResultSettings", () => ({
  default: () => ({
    resultNodeUid: "results",
    activeSort: [],
    filters: {},
    columnFilters: [],
    random: 0,
    page: 1,
    pageSize: 10,
    views: [{ uid: "text", mode: "link" }],
    searchFilter: "",
    showSearchFilter: false,
    showInterface: true,
    showInputs: false,
    showAlias: false,
    alias: "",
    layout: { mode: "table" },
  }),
}));
vi.mock("~/utils/postProcessResults", () => ({
  default: (results: unknown[]) => ({
    allProcessedResults: results,
    paginatedResults: results,
  }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
};

const click = async (element: HTMLElement | null): Promise<void> => {
  expect(element).not.toBeNull();
  act(() => element!.click());
  await settle();
};

describe("ResultsView Share Data", () => {
  it.each(["page reference", "page-level context", "regular query"])(
    "keeps the dialog open and usable from %s",
    async (context) => {
      const view = React.createElement(ResultsView, {
        parentUid: "query",
        results: [{ uid: "result", text: "A result" }],
        columns: [{ key: "text", uid: "text", selection: "text" }],
        onRefresh: vi.fn(),
        simplified: context !== "regular query",
        preventSavingSettings: context !== "regular query",
      });
      act(() => {
        root.render(
          context === "page reference"
            ? React.createElement(Popover, {
                autoFocus: false,
                target: React.createElement(
                  "button",
                  null,
                  "Discourse context",
                ),
                content: view,
              })
            : view,
        );
      });
      if (context === "page reference") {
        await click(container.querySelector("button"));
      }
      await click(
        document
          .querySelector<HTMLButtonElement>(
            ".roamjs-query-results-view .bp3-icon-more",
          )
          ?.closest("button") ?? null,
      );
      const share = Array.from(
        document.querySelectorAll<HTMLElement>(".bp3-menu-item"),
      ).find((item) => item.textContent === "Share Data");
      await click(share ?? null);

      expect(
        document.querySelector(".roamjs-query-results-view"),
      ).not.toBeNull();
      expect(document.querySelector(".bp3-dialog")?.textContent).toContain(
        "Share Query Results",
      );
      const input = document.querySelector<HTMLInputElement>(
        'input[aria-label="Filename"]',
      );
      expect(input).not.toBeNull();
      act(() => input!.focus());
      expect(document.activeElement).toBe(input);
      expect(
        Array.from(document.querySelectorAll(".bp3-menu-item")).some(
          (item) => item.textContent === "Share Data",
        ),
      ).toBe(false);

      await click(
        Array.from(
          document.querySelectorAll<HTMLButtonElement>(".bp3-dialog button"),
        ).find((button) => button.textContent === "Cancel") ?? null,
      );
      expect(document.querySelector(".bp3-dialog")).toBeNull();
      expect(
        document.querySelector(".roamjs-query-results-view"),
      ).not.toBeNull();
      if (context === "page reference") {
        await click(container.querySelector("button"));
        expect(document.querySelector(".roamjs-query-results-view")).toBeNull();
      }
    },
  );
});
