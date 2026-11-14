import { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import type { SearchableNode } from "~/services/QueryEngine";
import type { DiscourseNode } from "~/types";
import { groupNodesForSummonMenu } from "~/utils/nodeSummonResults";

// Stand-in scorer: earlier substring hits score higher, mirroring fuzzy search's ordering.
vi.mock("obsidian", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  prepareFuzzySearch: (query: string) => (text: string) => {
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    return index < 0
      ? null
      : { score: -index, matches: [[index, index + query.length]] };
  },
}));

const nodeType = (id: string, name: string): DiscourseNode => ({
  id,
  name,
  format: `${name} - {content}`,
  created: 0,
  modified: 0,
});

const CLAIM = nodeType("claim", "Claim");
const EVIDENCE = nodeType("evidence", "Evidence");
const QUESTION = nodeType("question", "Question");

const node = (title: string, nodeTypeId: string): SearchableNode => {
  const file = new TFile();
  file.path = `${title}.md`;
  file.basename = title;
  return { file, title, nodeTypeId };
};

const summarize = (
  groups: ReturnType<typeof groupNodesForSummonMenu>,
): { type: string; titles: string[] }[] =>
  groups.map((group) => ({
    type: group.nodeType.name,
    titles: group.nodes.map((n) => n.title),
  }));

describe("groupNodesForSummonMenu", () => {
  it("groups nodes under their type in settings order and hides empty types", () => {
    const groups = groupNodesForSummonMenu({
      nodes: [node("Arp2/3 KO", "evidence"), node("Actin branches", "claim")],
      nodeTypes: [CLAIM, EVIDENCE, QUESTION],
      query: "",
    });

    expect(summarize(groups)).toEqual([
      { type: "Claim", titles: ["Actin branches"] },
      { type: "Evidence", titles: ["Arp2/3 KO"] },
    ]);
  });

  it("keeps only the top 10 results for each type", () => {
    const claims = "LKJIHGFEDCBA".split("").map((t) => node(t, "claim"));

    const groups = groupNodesForSummonMenu({
      nodes: [...claims, node("Lone evidence", "evidence")],
      nodeTypes: [CLAIM, EVIDENCE],
      query: "",
    });

    expect(summarize(groups)).toEqual([
      {
        type: "Claim",
        titles: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"],
      },
      { type: "Evidence", titles: ["Lone evidence"] },
    ]);
  });

  it("narrows each type to matching titles, best match first", () => {
    const groups = groupNodesForSummonMenu({
      nodes: [
        node("Branched actin", "claim"),
        node("Actin cap", "claim"),
        node("Myosin pulls", "claim"),
        node("Myosin KO", "evidence"),
      ],
      nodeTypes: [CLAIM, EVIDENCE],
      query: "actin",
    });

    expect(summarize(groups)).toEqual([
      { type: "Claim", titles: ["Actin cap", "Branched actin"] },
    ]);
  });

  it("drops the groups of unchecked types", () => {
    const groups = groupNodesForSummonMenu({
      nodes: [node("Actin cap", "claim"), node("Myosin KO", "evidence")],
      nodeTypes: [CLAIM, EVIDENCE],
      query: "",
      nodeTypeIds: ["evidence"],
    });

    expect(summarize(groups)).toEqual([
      { type: "Evidence", titles: ["Myosin KO"] },
    ]);
  });

  it("keeps every group when no type is selected", () => {
    const groups = groupNodesForSummonMenu({
      nodes: [node("Actin cap", "claim"), node("Myosin KO", "evidence")],
      nodeTypes: [CLAIM, EVIDENCE],
      query: "",
      nodeTypeIds: [],
    });

    expect(summarize(groups).map((g) => g.type)).toEqual(["Claim", "Evidence"]);
  });

  it("returns no groups when nothing matches", () => {
    const groups = groupNodesForSummonMenu({
      nodes: [node("Actin cap", "claim")],
      nodeTypes: [CLAIM],
      query: "tubulin",
    });

    expect(groups).toEqual([]);
  });
});
