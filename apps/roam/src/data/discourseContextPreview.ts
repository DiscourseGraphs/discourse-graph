import INITIAL_NODE_VALUES from "./defaultDiscourseNodes";
import DEFAULT_RELATIONS_BLOCK_PROPS from "~/components/settings/data/defaultRelationsBlockProps";
import type { DiscourseContextResults } from "~/components/DiscourseContext";

export const DISCOURSE_CONTEXT_PREVIEW_NODES = {
  claim: {
    type: "_CLM-node",
    text: "Trees can cool city streets",
    refs: 2,
  },
  supportingClaim: {
    type: "_CLM-node",
    text: "Shade reduces the heat absorbed by pavement",
    refs: 1,
  },
  evidence: {
    type: "_EVD-node",
    text: "Shaded streets were cooler in a summer survey",
    refs: 3,
  },
  opposingEvidence: {
    type: "_EVD-node",
    text: "Some tree-lined streets stayed warm overnight",
    refs: 1,
  },
  question: {
    type: "_QUE-node",
    text: "How can cities reduce summer heat?",
    refs: 2,
  },
  source: {
    type: "_SRC-node",
    text: "Example urban heat study",
    refs: 2,
  },
} as const;

export type DiscourseContextPreviewNode =
  keyof typeof DISCOURSE_CONTEXT_PREVIEW_NODES;

const PREVIEW_RELATIONS: {
  type: string;
  source: DiscourseContextPreviewNode;
  destination: DiscourseContextPreviewNode;
}[] = [
  { type: "_SUPP-rel", source: "evidence", destination: "claim" },
  { type: "_SUPP-rel", source: "supportingClaim", destination: "claim" },
  { type: "_OPPO-rel", source: "opposingEvidence", destination: "claim" },
  { type: "_INFO-rel", source: "claim", destination: "question" },
  { type: "_INFO-rel", source: "source", destination: "evidence" },
];

export const getDiscourseContextPreview = (
  selectedNode: DiscourseContextPreviewNode,
): { results: DiscourseContextResults; score: number; refs: number } => {
  const grouped: Record<string, DiscourseContextResults[number]> = {};
  PREVIEW_RELATIONS.forEach(({ type, source, destination }) => {
    if (source !== selectedNode && destination !== selectedNode) return;
    const isComplement = destination === selectedNode;
    const relation = DEFAULT_RELATIONS_BLOCK_PROPS[type];
    const label = isComplement ? relation.complement : relation.label;
    const targetKey = isComplement ? source : destination;
    const target = DISCOURSE_CONTEXT_PREVIEW_NODES[targetKey];
    const uid = `dg-preview-${targetKey}`;
    const group = (grouped[label] ??= { label, results: {} });
    // Omit live relation IDs and page links so sample rows cannot mutate the graph.
    group.results[uid] = {
      uid,
      text: target.text,
      target: INITIAL_NODE_VALUES.find((node) => node.type === target.type)
        ?.text,
    };
  });
  const results = Object.values(grouped);
  return {
    results,
    score: results.reduce(
      (count, group) => count + Object.keys(group.results).length,
      0,
    ),
    refs: DISCOURSE_CONTEXT_PREVIEW_NODES[selectedNode].refs,
  };
};

export const getDiscourseContextPreviewLabel = (
  node: DiscourseContextPreviewNode,
): string => {
  const { type, text } = DISCOURSE_CONTEXT_PREVIEW_NODES[node];
  return `${INITIAL_NODE_VALUES.find((node) => node.type === type)?.text}: ${text}`;
};
