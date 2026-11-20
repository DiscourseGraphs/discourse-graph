// @vitest-environment jsdom
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initRelationsPages } from "~/components/mountRelationsPage";

const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  unmount: vi.fn(),
  props: vi.fn(),
  parent: vi.fn(),
}));
vi.mock("roamjs-components/util/renderWithUnmount", () => ({
  default: mocks.render,
}));
vi.mock("roamjs-components/dom", () => ({
  getUidsFromId: (id: string) => ({ blockUid: id }),
}));
vi.mock("roamjs-components/queries/getParentUidByBlockUid", () => ({
  default: mocks.parent,
}));
vi.mock("~/utils/getBlockProps", () => ({
  default: mocks.props,
  isJsonObject: (value: unknown) =>
    Boolean(value && typeof value === "object" && !Array.isArray(value)),
}));
vi.mock("~/components/RelationsPage", () => ({ default: () => null }));
let pages: ReturnType<typeof initRelationsPages>;
let article: HTMLElement;
let heading: HTMLElement;
let loaded: (uids: string[] | null) => void;
let setVisible: (visible: boolean) => void;
const addBlock = ({
  uid,
  parent = article,
}: {
  uid: string;
  parent?: HTMLElement;
}): HTMLElement => {
  const container = document.createElement("div");
  container.className = "roam-block-container";
  const block = document.createElement("div");
  block.className = "roam-block";
  block.id = uid;
  container.append(block);
  parent.append(container);
  return container;
};
beforeEach(() => {
  vi.resetAllMocks();
  document.body.innerHTML =
    '<article class="roam-article"><div class="rm-title-display-container"><h1>Relations</h1></div></article>';
  article = document.querySelector("article")!;
  heading = document.querySelector("h1")!;
  mocks.render.mockImplementation(
    (
      element: React.ReactElement<{
        onRowsLoaded: typeof loaded;
        onVisibilityChange: typeof setVisible;
      }>,
    ) => {
      loaded = element.props.onRowsLoaded;
      setVisible = element.props.onVisibilityChange;
      return mocks.unmount;
    },
  );
  mocks.props.mockReturnValue({ "discourse-graph": {} });
  mocks.parent.mockReturnValue("storage");
  pages = initRelationsPages();
  pages.mount({
    heading,
    title: "roam/js/discourse-graph/relations",
    pageUid: "storage",
  });
});
afterEach(() => {
  pages.dispose();
  document.body.innerHTML = "";
});
describe("relations page mounting", () => {
  it("restores storage while hidden, including new blocks and refreshed rows, then conceals it again", async () => {
    const direct = addBlock({ uid: "direct" });
    loaded(["direct"]);
    expect(direct.classList.contains("dg-relation-storage-block")).toBe(true);
    setVisible(false);
    expect(direct.classList.contains("dg-relation-storage-block")).toBe(false);
    const added = addBlock({ uid: "added" });
    await Promise.resolve();
    expect(added.classList.contains("dg-relation-storage-block")).toBe(false);
    loaded(["direct", "added"]);
    expect(direct.classList.contains("dg-relation-storage-block")).toBe(false);
    expect(added.classList.contains("dg-relation-storage-block")).toBe(false);
    setVisible(true);
    expect(direct.classList.contains("dg-relation-storage-block")).toBe(true);
    expect(added.classList.contains("dg-relation-storage-block")).toBe(true);
    setVisible(false);
    loaded(null);
    setVisible(true);
    expect(direct.classList.contains("dg-relation-storage-block")).toBe(false);
    expect(added.classList.contains("dg-relation-storage-block")).toBe(false);
  });
  it("conceals the first live relation on an empty page but preserves nested relations and notes", async () => {
    loaded([]);
    mocks.parent.mockImplementation((uid: string) =>
      uid === "nested" ? "note" : "storage",
    );
    mocks.props.mockImplementation((uid: string) =>
      uid === "note" ? {} : { "discourse-graph": {} },
    );
    const note = addBlock({ uid: "note" });
    const nested = addBlock({ uid: "nested", parent: note });
    const direct = addBlock({ uid: "direct" });
    await Promise.resolve();
    expect(direct.classList.contains("dg-relation-storage-block")).toBe(true);
    expect(nested.classList.contains("dg-relation-storage-block")).toBe(false);
    expect(note.classList.contains("dg-relation-storage-block")).toBe(false);
  });
  it("ignores UI mutations and restores storage on failure or unmount", async () => {
    const direct = addBlock({ uid: "direct" });
    loaded(["direct"]);
    await Promise.resolve();
    mocks.parent.mockClear();
    mocks.props.mockClear();
    addBlock({
      uid: "rendered-preview",
      parent: article.querySelector<HTMLElement>(".dg-relations-host")!,
    });
    await Promise.resolve();
    expect(mocks.parent).not.toHaveBeenCalled();
    expect(mocks.props).not.toHaveBeenCalled();
    loaded(null);
    expect(direct.classList.contains("dg-relation-storage-block")).toBe(false);
    loaded(["direct"]);
    pages.unmount(heading);
    expect(direct.classList.contains("dg-relation-storage-block")).toBe(false);
    expect(article.querySelector(".dg-relations-host")).toBeNull();
    expect(mocks.unmount).toHaveBeenCalledTimes(1);
    addBlock({ uid: "after-unmount" });
    await Promise.resolve();
    expect(mocks.props).not.toHaveBeenCalled();
  });
  it("does not mount twice for the same heading", () => {
    pages.mount({
      heading,
      title: "roam/js/discourse-graph/relations",
      pageUid: "storage",
    });
    expect(mocks.render).toHaveBeenCalledTimes(1);
  });
});
