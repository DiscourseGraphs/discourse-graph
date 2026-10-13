import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadRelationRows,
  selectRelationRows,
  type RelationRow,
} from "~/components/relationsPageData";

vi.mock("~/utils/getDiscourseRelations", () => ({
  default: () => [
    { id: "supports", label: "Supports" },
    { id: "challenges", label: "Challenges" },
  ],
}));
const q = vi.fn();
const pull = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", { roamAlphaAPI: { data: { async: { q } }, pull } });
});

describe("relations page data", () => {
  it("resolves page and block endpoints, preserves raw props, and ignores other blocks", async () => {
    const props = {
      ":discourse-graph": {
        ":hasSchema": "supports",
        ":sourceUid": "page",
        ":destinationUid": "block",
        ":tentative": "true",
      },
      ":extra": "keep",
    };
    q.mockResolvedValue([
      ["rel", props, 1704067200000],
      ["note", { unrelated: true }],
    ]);
    pull.mockImplementation((_pattern, [, uid]) =>
      uid === "page"
        ? { ":node/title": "A claim" }
        : { ":block/string": "Evidence" },
    );
    const rows = await loadRelationRows("storage-page");
    expect(q.mock.calls[0][1]).toBe("storage-page");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "Supports",
      tentative: true,
      createdAt: 1704067200000,
      props,
      source: { text: "A claim", isPage: true },
      destination: { text: "Evidence", isPage: false },
    });
    expect(rows[0].props).toBe(props);
  });

  it("keeps malformed relations inspectable and shares endpoint lookups", async () => {
    q.mockResolvedValue([
      [
        "one",
        {
          "discourse-graph": {
            sourceUid: "deleted",
            destinationUid: "deleted",
            hasSchema: "missing",
          },
        },
      ],
      ["two", { "discourse-graph": { sourceUid: 42 } }],
      ["invalid", { "discourse-graph": null }],
    ]);
    pull.mockReturnValue(null);
    const rows = await loadRelationRows("storage");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      type: "Unknown type",
      source: { text: "Missing node", exists: false },
    });
    expect(rows[1].source.uid).toBe("");
    expect(rows.every((row) => row.createdAt === null)).toBe(true);
    expect(pull).toHaveBeenCalledTimes(1);
  });

  it("propagates read failures instead of presenting an empty graph", async () => {
    q.mockRejectedValue(new Error("read failed"));
    await expect(loadRelationRows("storage")).rejects.toThrow("read failed");
  });
  it.each([-1, NaN, Infinity, 9e15, "1704067200000"])(
    "keeps a relation with an invalid creation time (%s) inspectable",
    async (createdAt) => {
      q.mockResolvedValue([["rel", { "discourse-graph": {} }, createdAt]]);
      expect((await loadRelationRows("storage"))[0].createdAt).toBeNull();
    },
  );
});

const row = ({
  uid,
  type,
  source,
  destination,
}: {
  uid: string;
  type: string;
  source: string;
  destination: string;
}): RelationRow => ({
  uid,
  type,
  schemaUid: type.toLowerCase(),
  tentative: false,
  props: {},
  createdAt: null,
  source: { uid: `source-${uid}`, text: source, exists: true, isPage: true },
  destination: {
    uid: `dest-${uid}`,
    text: destination,
    exists: true,
    isPage: true,
  },
});
const rows = [
  row({ uid: "b", type: "Supports", source: "Study 10", destination: "Alpha" }),
  row({ uid: "a", type: "Challenges", source: "Study 2", destination: "Beta" }),
  row({ uid: "c", type: "Supports", source: "Study 1", destination: "Gamma" }),
];
describe("relations page filtering and sorting", () => {
  it.each([false, true])(
    "sorts creation timestamps chronologically (descending: %s), with unknown dates last",
    (descending) => {
      const dated = [
        { ...rows[0], uid: "new", createdAt: Date.UTC(2026, 0, 1) },
        { ...rows[0], uid: "unknown", createdAt: null },
        { ...rows[0], uid: "old", createdAt: Date.UTC(2025, 11, 31) },
        { ...rows[0], uid: "epoch", createdAt: 0 },
      ];
      expect(
        selectRelationRows({
          rows: dated,
          type: "",
          search: "",
          sort: "createdAt",
          descending,
        }).map((row) => row.uid),
      ).toEqual(
        descending
          ? ["new", "old", "epoch", "unknown"]
          : ["epoch", "old", "new", "unknown"],
      );
    },
  );
  it("combines type and case-insensitive search including endpoint UIDs", () => {
    expect(
      selectRelationRows({
        rows,
        type: "supports",
        search: "  STUDY 1  ",
        sort: "type",
        descending: false,
      }).map((r) => r.uid),
    ).toEqual(["b", "c"]);
    expect(
      selectRelationRows({
        rows,
        type: "supports",
        search: "dest-a",
        sort: "type",
        descending: false,
      }),
    ).toEqual([]);
    expect(
      selectRelationRows({
        rows,
        type: "",
        search: "dest-a",
        sort: "type",
        descending: false,
      }).map((r) => r.uid),
    ).toEqual(["a"]);
  });
  it.each([
    ["type", false, ["a", "b", "c"]],
    ["source", false, ["c", "a", "b"]],
    ["destination", true, ["c", "a", "b"]],
  ] as const)(
    "sorts by %s without modifying the loaded data",
    (sort, descending, expected) => {
      expect(
        selectRelationRows({
          rows,
          type: "",
          search: "",
          sort,
          descending,
        }).map((r) => r.uid),
      ).toEqual(expected);
      expect(rows.map((r) => r.uid)).toEqual(["b", "a", "c"]);
    },
  );
});
