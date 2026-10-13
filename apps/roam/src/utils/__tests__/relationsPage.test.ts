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
  vi.resetAllMocks();
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
    q.mockResolvedValueOnce([
      ["rel", props, 1704067200000],
      ["note", { unrelated: true }],
    ]).mockResolvedValueOnce([
      [{ uid: "page", title: "A claim" }],
      [{ uid: "block", string: "Evidence" }],
    ]);
    const rows = await loadRelationRows("storage-page");
    expect(q.mock.calls[0][1]).toBe("storage-page");
    expect(q.mock.calls[1][1]).toEqual(["page", "block"]);
    expect(pull).not.toHaveBeenCalled();
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
    q.mockResolvedValueOnce([
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
    ]).mockResolvedValueOnce([]);
    const rows = await loadRelationRows("storage");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      type: "Unknown type",
      source: { text: "Missing node", exists: false },
    });
    expect(rows[1].source.uid).toBe("");
    expect(rows.every((row) => row.createdAt === null)).toBe(true);
    expect(q).toHaveBeenCalledTimes(2);
    expect(q.mock.calls[1][1]).toEqual(["deleted"]);
    expect(pull).not.toHaveBeenCalled();
  });

  it("loads thousands of endpoints with one asynchronous batch instead of synchronous reads", async () => {
    const records = Array.from({ length: 2000 }, (_, index) => [
      `relation-${index}`,
      {
        "discourse-graph": {
          sourceUid: `source-${index}`,
          destinationUid: "shared",
        },
      },
      1704067200000,
    ]);
    q.mockResolvedValueOnce(records).mockImplementationOnce(
      (_query, uids: string[]) =>
        Promise.resolve(uids.map((uid) => [{ uid: uid, title: uid }])),
    );
    const rows = await loadRelationRows("storage");
    expect(rows).toHaveLength(2000);
    expect(rows[1999].source).toMatchObject({
      text: "source-1999",
      exists: true,
    });
    expect(q).toHaveBeenCalledTimes(2);
    expect(q.mock.calls[1][1]).toHaveLength(2001);
    expect(pull).not.toHaveBeenCalled();
  });

  it("skips endpoint loading when no valid endpoint UIDs exist", async () => {
    q.mockResolvedValueOnce([
      ["rel", { "discourse-graph": { sourceUid: "", destinationUid: 42 } }],
    ]);
    const rows = await loadRelationRows("storage");
    expect(rows[0].source.exists).toBe(false);
    expect(rows[0].destination.exists).toBe(false);
    expect(q).toHaveBeenCalledTimes(1);
  });

  it("propagates a failed endpoint batch instead of marking every node missing", async () => {
    q.mockResolvedValueOnce([
      ["rel", { "discourse-graph": { sourceUid: "page" } }],
    ]).mockRejectedValueOnce(new Error("endpoint read failed"));
    await expect(loadRelationRows("storage")).rejects.toThrow(
      "endpoint read failed",
    );
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
