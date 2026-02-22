import {
  ExtractedNode,
  NodeType,
  NODE_FORMAT_MAP,
  NODE_TYPE_LABELS,
} from "~/types/extraction";

const formatNodeTitle = (node: ExtractedNode): string => {
  const format = NODE_FORMAT_MAP[node.type];
  return format.replace("{content}", node.content).replace("{Source}", "");
};

const formatNodeBullet = (node: ExtractedNode): string => {
  const lines: string[] = [];
  lines.push(`- ${formatNodeTitle(node)}`);

  if (node.sourceQuote) {
    lines.push(`    - Source quote: "${node.sourceQuote}"`);
  }
  if (node.pageNumber !== undefined) {
    lines.push(`    - Page: ${node.pageNumber}`);
  }
  if (node.section) {
    lines.push(`    - Section: ${node.section}`);
  }

  return lines.join("\n");
};

const TYPE_ORDER: NodeType[] = [
  "SRC", "HYP", "QUE", "ISS",
  "EXP", "MTD", "RES", "EVD",
  "PAT", "CLM", "THR", "CON", "ART",
];

export const formatNodesForClipboard = (nodes: ExtractedNode[]): string => {
  const grouped = new Map<NodeType, ExtractedNode[]>();
  for (const node of nodes) {
    const list = grouped.get(node.type) ?? [];
    list.push(node);
    grouped.set(node.type, list);
  }

  const sections: string[] = [];
  for (const type of TYPE_ORDER) {
    const group = grouped.get(type);
    if (!group?.length) continue;

    sections.push(`**${NODE_TYPE_LABELS[type]}s**`);
    for (const node of group) {
      sections.push(formatNodeBullet(node));
    }
    sections.push("");
  }

  return sections.join("\n").trim();
};
