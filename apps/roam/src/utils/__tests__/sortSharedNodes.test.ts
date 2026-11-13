import { describe, expect, it } from "vitest";
import type { DbCrossAppNode } from "@repo/database/lib/dbToCrossAppConverters";
import type { SharedNodeSpace } from "@repo/database/lib/sharedNodes";
import {
  DEFAULT_SHARED_NODE_SORT,
  getNextSharedNodeSort,
  sortSharedNodes,
} from "~/utils/sortSharedNodes";

const makeSpace = (url: string, name: string): SharedNodeSpace => ({
  id: 0,
  name,
  platform: "Obsidian",
  url,
});

const spaces = Object.fromEntries(
  [
    makeSpace("obsidian:beta", "beta vault"),
    makeSpace("obsidian:alpha", "Alpha graph"),
    makeSpace("obsidian:gamma", "Gamma vault"),
  ].map((space) => [space.url, space]),
);

const makeNode = ({
  spaceUrl,
  title,
  modifiedAt,
}: {
  spaceUrl: string;
  title: string;
  modifiedAt: string;
}): DbCrossAppNode => ({
  rid: `orn:obsidian.note:${spaceUrl.split(":")[1]}/${title}`,
  localId: title,
  nodeType: "claim-type",
  coreTitle: title,
  content: { direct: { value: title } },
  createdAt: new Date("2026-06-14T09:00:00.000Z"),
  modifiedAt: new Date(modifiedAt),
  authorId: "account-7",
});

const older = makeNode({
  spaceUrl: "obsidian:beta",
  title: "Claim 10",
  modifiedAt: "2026-06-14T09:00:00.000Z",
});
const newer = makeNode({
  spaceUrl: "obsidian:alpha",
  title: "Claim 9",
  modifiedAt: "2026-06-14T15:00:00.000Z",
});
const newest = makeNode({
  spaceUrl: "obsidian:gamma",
  title: "evidence",
  modifiedAt: "2026-06-14T14:00:00.000-02:00",
});

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
        spaces,
        sort: DEFAULT_SHARED_NODE_SORT,
      }),
    ).toEqual([newest, newer, older]);
  });

  it("sorts text columns ignoring case and comparing numbers by value", () => {
    expect(
      sortSharedNodes({
        nodes: [newest, older, newer],
        spaces,
        sort: { column: "title", direction: "ascending" },
      }),
    ).toEqual([newer, older, newest]);
    expect(
      sortSharedNodes({
        nodes: [newest, older, newer],
        spaces,
        sort: { column: "spaceName", direction: "descending" },
      }),
    ).toEqual([newest, older, newer]);
  });

  it("does not reorder the input", () => {
    const nodes = [older, newest, newer];
    sortSharedNodes({ nodes, spaces, sort: DEFAULT_SHARED_NODE_SORT });
    expect(nodes).toEqual([older, newest, newer]);
  });
});
