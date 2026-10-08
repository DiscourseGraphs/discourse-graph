import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHARED_NODE_SORT,
  getNextSharedNodeSort,
  sortSharedNodes,
} from "~/utils/sortSharedNodes";

const older = {
  spaceName: "beta vault",
  title: "Claim 10",
  lastModified: "2026-06-14T09:00:00.000Z",
};
const newer = {
  spaceName: "Alpha graph",
  title: "Claim 9",
  lastModified: "2026-06-14T15:00:00.000Z",
};
const newest = {
  spaceName: "Gamma vault",
  title: "evidence",
  lastModified: "2026-06-14T14:00:00.000-02:00",
};

describe("getNextSharedNodeSort", () => {
  it("sorts a newly clicked column descending", () => {
    expect(
      getNextSharedNodeSort({
        currentSort: DEFAULT_SHARED_NODE_SORT,
        column: "title",
      }),
    ).toEqual({ column: "title", direction: "descending" });
  });

  it("toggles the active column between descending and ascending", () => {
    const ascending = getNextSharedNodeSort({
      currentSort: DEFAULT_SHARED_NODE_SORT,
      column: "lastModified",
    });
    expect(ascending).toEqual({
      column: "lastModified",
      direction: "ascending",
    });
    expect(
      getNextSharedNodeSort({ currentSort: ascending, column: "lastModified" }),
    ).toEqual(DEFAULT_SHARED_NODE_SORT);
  });
});

describe("sortSharedNodes", () => {
  it("defaults to most recently modified first, comparing instants", () => {
    expect(
      sortSharedNodes({
        nodes: [older, newest, newer],
        sort: DEFAULT_SHARED_NODE_SORT,
      }),
    ).toEqual([newest, newer, older]);
  });

  it("sorts text columns ignoring case and comparing numbers by value", () => {
    expect(
      sortSharedNodes({
        nodes: [newest, older, newer],
        sort: { column: "title", direction: "ascending" },
      }),
    ).toEqual([newer, older, newest]);
    expect(
      sortSharedNodes({
        nodes: [newest, older, newer],
        sort: { column: "spaceName", direction: "descending" },
      }),
    ).toEqual([newest, older, newer]);
  });

  it("does not reorder the input", () => {
    const nodes = [older, newest, newer];
    sortSharedNodes({ nodes, sort: DEFAULT_SHARED_NODE_SORT });
    expect(nodes).toEqual([older, newest, newer]);
  });
});
