import { type DiscourseNode } from "~/utils/getDiscourseNodes";

export type SearchResult = {
  uid: string;
  title: string;
  type: string; // matches NodeTypeConfig.id
  refs: number;
  lastModified: string;
  authorName: string;
  fromCurrentGraph: boolean;
};

export type SortKey =
  | "relevance"
  | "date_modified"
  | "date_created"
  | "alphabetical"
  | "most_connected";

export type SortDir = "asc" | "desc";

export type Sort = {
  key: SortKey;
  dir: SortDir;
};

export type NodeTypeConfig = {
  id: string;
  label: string;
  abbrev: string; // 3-letter display, e.g. "EVD"
  color: string;
  trigger: string; // abbrev lowercased, e.g. "evd"
  aliases: string[]; // all recognized aliases for chip trigger
  kind: "node" | "page" | "block";
};

export type TextSegment = {
  text: string;
  hit: boolean;
};

/** Split text into highlighted/plain segments for keyword matching. */
export const splitWithHighlights = (
  text: string,
  keywords: string[],
): TextSegment[] => {
  if (!keywords.length) return [{ text, hit: false }];

  const escaped = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);

  return parts
    .filter((p) => p.length > 0)
    .map((part) => ({
      text: part,
      hit: regex.test(part),
    }));
};

/** Build NodeTypeConfig array from DiscourseNode list. */
export const buildNodeTypeConfigs = (
  nodes: DiscourseNode[],
): NodeTypeConfig[] => {
  return nodes.map((node): NodeTypeConfig => {
    const kind =
      node.type === "page-node"
        ? "page"
        : node.type === "blck-node"
          ? "block"
          : "node";

    // Derive abbreviation: prefer node.tag (first 3 chars), fallback to node.text
    const abbrevSource = node.tag?.trim() ? node.tag.trim() : node.text.trim();
    const abbrev = abbrevSource.slice(0, 3).toUpperCase();
    const trigger = abbrev.toLowerCase();

    // Build aliases: trigger, full label, tag if different
    const aliases = Array.from(
      new Set(
        [
          trigger,
          node.text.toLowerCase(),
          node.tag?.toLowerCase().slice(0, 3),
          node.tag?.toLowerCase(),
        ].filter(Boolean) as string[],
      ),
    );

    return {
      id: node.type,
      label: node.text,
      abbrev,
      color: node.canvasSettings?.color ?? "#8E8E8E",
      trigger,
      aliases,
      kind,
    };
  });
};
