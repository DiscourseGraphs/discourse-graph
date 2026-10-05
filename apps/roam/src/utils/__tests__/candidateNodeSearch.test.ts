import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import {
  buildCandidateBlocksByTagQuery,
  getCandidateTagTitle,
  stripCandidateTags,
  type PulledDiscourseNode,
} from "~/utils/discourseNodeSearch";
import {
  buildSearchIndex,
  searchDiscourseNodesWithMiniSearch,
} from "~/components/AdvancedNodeSearchDialog/utils";
import { runRoamSemanticSearch } from "~/utils/discourseNodeSearchProviders";

// getDiscourseNodes builds its defaults at import time.
vi.hoisted(() => {
  (globalThis as { window?: unknown }).window = {
    roamAlphaAPI: { util: { generateUID: () => "uid" } },
  };
});

const originalWindow = (globalThis as { window?: unknown }).window;

const node = (overrides: Partial<DiscourseNode>): DiscourseNode => ({
  type: "clm",
  text: "Claim",
  format: "[[CLM]] - {content}",
  shortcut: "C",
  tag: "",
  backedBy: "user",
  specification: [],
  canvasSettings: {},
  ...overrides,
});

const claim = node({ tag: "#clm-candidate" });
const evidence = node({
  type: "evd",
  text: "Evidence",
  format: "[[EVD]] - {content}",
  tag: "#evd-candidate",
});

const pulledPage = (uid: string, title: string): PulledDiscourseNode => ({
  ":block/uid": uid,
  ":node/title": title,
  ":create/time": 1,
  ":edit/time": 2,
});

const pulledBlock = (uid: string, text: string): PulledDiscourseNode => ({
  ":block/uid": uid,
  ":block/string": text,
  ":create/time": 3,
  ":edit/time": 4,
});

const mockRoamQuery = (respond: (query: string) => PulledDiscourseNode[]) => {
  const q = vi.fn((query: string) =>
    Promise.resolve(respond(query).map((result) => [result])),
  );
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: { data: { async: { fast: { q } } } },
  };
  return q;
};

const respondByQuery = (query: string): PulledDiscourseNode[] => {
  if (query.includes('"clm-candidate"')) {
    return [
      pulledBlock("b1", "Soil moisture drives yield #clm-candidate"),
      pulledBlock("b2", "#clm-candidate #evd-candidate shared block"),
      pulledBlock("b3", "#clm-candidate"),
    ];
  }
  if (query.includes('"evd-candidate"')) {
    return [pulledBlock("b2", "#clm-candidate #evd-candidate shared block")];
  }
  if (query.includes("CLM")) return [pulledPage("p1", "[[CLM]] - Soil")];
  return [];
};

afterEach(() => {
  (globalThis as { window?: unknown }).window = originalWindow;
});

describe("candidate tag helpers", () => {
  it("strips the leading hash from a configured tag", () => {
    expect(getCandidateTagTitle("#clm-candidate")).toBe("clm-candidate");
    expect(getCandidateTagTitle("clm-candidate")).toBe("clm-candidate");
  });

  it("queries blocks that reference the tag page by exact title", () => {
    const query = buildCandidateBlocksByTagQuery({
      tagTitle: 'say "hi"',
      pullExpression: "[:block/uid]",
    });

    expect(query).toContain('[?tag :node/title "say \\"hi\\""]');
    expect(query).toContain("[?block :block/refs ?tag]");
  });

  it("strips every tag form for the configured tags only", () => {
    expect(
      stripCandidateTags({
        text: "#clm-candidate Soil #[[evd-candidate]] drives [[clm-candidate]] #keep",
        tagTitles: ["clm-candidate", "evd-candidate"],
      }),
    ).toBe("Soil drives #keep");
  });

  it("keeps a longer tag that only starts with a configured tag", () => {
    expect(
      stripCandidateTags({
        text: "Soil #clm-candidates",
        tagTitles: ["clm-candidate"],
      }),
    ).toBe("Soil #clm-candidates");
  });
});

describe("buildSearchIndex", () => {
  it("indexes only node pages when candidates are off", async () => {
    const q = mockRoamQuery(respondByQuery);

    const { results } = await buildSearchIndex({
      discourseNodes: [claim, evidence],
    });

    expect(results.map((result) => result.uid)).toEqual(["p1"]);
    expect(q.mock.calls.some(([query]) => query.includes(":block/refs"))).toBe(
      false,
    );
  });

  it("adds tagged blocks as candidates, one row per block", async () => {
    mockRoamQuery(respondByQuery);

    const { results } = await buildSearchIndex({
      discourseNodes: [claim, evidence],
      includeCandidates: true,
    });

    expect(
      results.map(({ uid, type, title, isCandidate }) => ({
        uid,
        type,
        title,
        isCandidate,
      })),
    ).toEqual([
      {
        uid: "p1",
        type: "clm",
        title: "[[CLM]] - Soil",
        isCandidate: undefined,
      },
      {
        uid: "b1",
        type: "clm",
        title: "Soil moisture drives yield",
        isCandidate: true,
      },
      { uid: "b2", type: "clm", title: "shared block", isCandidate: true },
    ]);
  });

  it("skips node types without a tag", async () => {
    const q = mockRoamQuery(respondByQuery);

    await buildSearchIndex({
      discourseNodes: [node({ tag: "" })],
      includeCandidates: true,
    });

    expect(q.mock.calls.some(([query]) => query.includes(":block/refs"))).toBe(
      false,
    );
  });

  it("keeps node results when a candidate query fails", async () => {
    mockRoamQuery((query) => {
      if (query.includes(":block/refs")) throw new Error("query failed");
      return respondByQuery(query);
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { results } = await buildSearchIndex({
      discourseNodes: [claim],
      includeCandidates: true,
    });

    expect(results.map((result) => result.uid)).toEqual(["p1"]);
  });

  it("matches candidates on block text and applies the type filter", async () => {
    mockRoamQuery(respondByQuery);
    const { miniSearch, results } = await buildSearchIndex({
      discourseNodes: [claim, evidence],
      includeCandidates: true,
    });

    const search = (typeFilter?: string[]) =>
      searchDiscourseNodesWithMiniSearch({
        miniSearch,
        allResults: results,
        searchTerm: "moisture",
        typeFilter,
      }).map((entry) => entry.result.uid);

    expect(search()).toEqual(["b1"]);
    expect(search(["evd"])).toEqual([]);
  });
});

describe("runRoamSemanticSearch", () => {
  type Hit = { uid: string; type: "page" | "block" | "chunk" };
  const semanticSearch = vi.fn<(args: Record<string, unknown>) => Hit[]>();
  const titles: Record<string, string> = {
    p1: "[[CLM]] - Soil",
    p2: "Daily notes",
  };

  beforeEach(() => {
    semanticSearch.mockReset();
    (globalThis as { window: unknown }).window = {
      roamAlphaAPI: {
        data: {
          semanticSearchEnabled: () => true,
          async: {
            semanticSearch: (args: Record<string, unknown>) =>
              Promise.resolve(semanticSearch(args)),
            pull_many: (_pattern: string, ids: [string, string][]) =>
              Promise.resolve(
                ids.map(([, uid]) =>
                  titles[uid]
                    ? { ":block/uid": uid, ":node/title": titles[uid] }
                    : null,
                ),
              ),
          },
        },
      },
    };
  });

  const run = (candidateUids?: Set<string>) =>
    runRoamSemanticSearch({
      nodeTypes: [claim],
      query: "soil",
      candidateUids,
    });

  it("searches pages only when there are no candidates", async () => {
    semanticSearch.mockReturnValue([
      { uid: "p1", type: "page" },
      { uid: "b1", type: "block" },
    ]);

    const { filteredResults } = await run();

    expect(semanticSearch.mock.calls[0]?.[0]).toMatchObject({
      "search-blocks": false,
      "search-pages": true,
    });
    expect(filteredResults.map((result) => result.uid)).toEqual(["p1"]);
  });

  it("keeps node pages and candidate blocks in hit order", async () => {
    semanticSearch.mockReturnValue([
      { uid: "b1", type: "block" },
      { uid: "p2", type: "page" },
      { uid: "b9", type: "block" },
      { uid: "p1", type: "page" },
    ]);

    const { filteredResults, filteredResultCount } = await run(new Set(["b1"]));

    expect(semanticSearch.mock.calls[0]?.[0]).toMatchObject({
      "search-blocks": true,
      "search-pages": true,
    });
    expect(filteredResults.map((result) => result.uid)).toEqual(["b1", "p1"]);
    expect(filteredResultCount).toBe(2);
  });
});
