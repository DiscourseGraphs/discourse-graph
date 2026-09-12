// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CreateRelationButton } from "~/components/CreateRelationDialog";
import SuggestionsBody from "~/components/SuggestionsBody";
import { acceptImportedRelationSchema } from "~/utils/relationSchemaAcceptance";
import { markRelationSchemaDeleted } from "~/utils/relationSchemaChanges";
import { DISCOURSE_GRAPH_PROP_NAME } from "~/utils/createReifiedBlock";
import { IMPORTED_FROM_PROP_KEY } from "~/utils/importedSourceIdentity";
import type { json } from "~/utils/getBlockProps";

const mocks = vi.hoisted(() => ({
  search: vi.fn().mockResolvedValue([]),
  props: new Map<string, Record<string, json>>(),
}));
vi.mock("~/utils/hyde", () => ({ performHydeSearch: mocks.search }));
vi.mock("~/utils/getDiscourseNodes", () => ({
  default: () => [
    { type: "source", text: "Source", format: "{content}" },
    { type: "target", text: "Target", format: "{content}" },
  ],
}));
vi.mock("~/utils/findDiscourseNode", () => ({
  default: () => ({ type: "source" }),
}));
vi.mock("~/utils/getDiscourseRelations", () => ({
  default: () => [
    {
      id: "mounted-schema",
      source: "source",
      destination: "target",
      label: "supports",
      complement: "supported by",
      triples: [],
    },
  ],
}));
vi.mock("~/utils/getDiscourseContextResults", () => ({
  default: vi.fn().mockResolvedValue([]),
}));
vi.mock("~/utils/storedRelations", () => ({
  getStoredRelationsEnabled: () => true,
}));
vi.mock("~/components/settings/utils/accessors", () => ({
  getGlobalSetting: () => [],
}));
vi.mock("~/utils/internalError", () => ({ default: vi.fn() }));
vi.mock("~/utils/notifySuggestiveModeAdoption", () => ({
  notifyBlockSuggestionAdded: vi.fn(),
  notifyRelationSuggestionAdded: vi.fn(),
}));
vi.mock("~/utils/discourseContextMutationRefresh", () => ({
  refreshDiscourseContextsForMutatedUids: vi.fn(),
}));
vi.mock("roamjs-components/queries/getAllPageNames", () => ({
  default: () => [],
}));
vi.mock("roamjs-components/queries/getPageTitleByPageUid", () => ({
  default: () => "Source page",
}));
vi.mock("roamjs-components/queries/getPageUidByPageTitle", () => ({
  default: () => "source-page",
}));
vi.mock("roamjs-components/components/AutocompleteInput", () => ({
  default: () => null,
}));
vi.mock("roamjs-components/components/MenuItemSelect", () => ({
  default: () => null,
}));
vi.mock("roamjs-components/util/renderOverlay", () => ({ default: vi.fn() }));
vi.mock("roamjs-components/components/Toast", () => ({ render: vi.fn() }));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  mocks.props.set("mounted-schema", {
    [DISCOURSE_GRAPH_PROP_NAME]: {
      [IMPORTED_FROM_PROP_KEY]: {
        sourceNodeRid: "orn:obsidian.schema:vault/relation",
        sourceModifiedAt: "2026-08-01T00:00:00.000Z",
      },
    },
  });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(window, {
    roamAlphaAPI: {
      pull: (_pattern: string, [, uid]: [string, string]) => ({
        ":block/props": mocks.props.get(uid) ?? {},
      }),
      data: {
        block: {
          update: vi.fn(
            ({
              block,
            }: {
              block: { uid: string; props: Record<string, json> };
            }) => {
              mocks.props.set(block.uid, block.props);
              return Promise.resolve();
            },
          ),
        },
        backend: { q: vi.fn().mockResolvedValue([]) },
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
  vi.clearAllMocks();
});
const clickAllPages = async (): Promise<void> => {
  const button = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "All Pages",
  );
  expect(button).toBeDefined();
  await act(() => {
    button?.click();
    return Promise.resolve();
  });
};
it("refreshes both mounted creation interfaces after acceptance and deletion", async () => {
  await act(() => {
    root.render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(CreateRelationButton, {
          sourceNodeUid: "source-page",
        }),
        React.createElement(SuggestionsBody, {
          tag: "Source page",
          blockUid: "suggestions-block",
        }),
      ),
    );
    return Promise.resolve();
  });
  const addButton = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Add relation",
  );
  expect(addButton?.disabled).toBe(true);
  await clickAllPages();
  expect(mocks.search).toHaveBeenLastCalledWith(
    expect.objectContaining({ validTypes: [], uniqueRelationTypeTriplets: [] }),
  );
  await act(async () => {
    await acceptImportedRelationSchema("mounted-schema");
  });
  expect(addButton?.disabled).toBe(false);
  await clickAllPages();
  expect(mocks.search).toHaveBeenLastCalledWith(
    expect.objectContaining({ validTypes: ["target"] }),
  );
  act(() => {
    markRelationSchemaDeleted("mounted-schema");
  });
  expect(addButton?.disabled).toBe(true);
  await clickAllPages();
  expect(mocks.search).toHaveBeenLastCalledWith(
    expect.objectContaining({ validTypes: [], uniqueRelationTypeTriplets: [] }),
  );
});
