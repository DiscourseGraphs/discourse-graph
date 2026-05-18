import MiniSearch from "minisearch";
import { type DiscourseNode } from "~/utils/getDiscourseNodes";
import getDiscourseNodeFormatExpression from "~/utils/getDiscourseNodeFormatExpression";

export const DEBOUNCE_MS = 250;
export const MAX_RESULTS = 50;
export const MIN_SEARCH_SCORE = 0.1;
export const EXCERPT_LENGTH = 200;

export type SearchResult = {
  uid: string;
  title: string;
  type: string;
  nodeTypeLabel: string;
  excerpt: string;
  createdAt: string;
  lastModified: string;
  authorName: string;
};

export type NodeContent = {
  title: string;
  lines: string[];
  excerpt: string;
};

/* eslint-disable @typescript-eslint/naming-convention */
type PulledNode = {
  [key: string]: unknown;
  ":block/string"?: string;
  ":block/uid"?: string;
  ":node/title"?: string;
  ":create/time"?: string | number;
  ":edit/time"?: string | number;
  ":create/user"?: PulledUser;
  ":edit/user"?: PulledUser;
  ":block/children"?: PulledBlock[];
};

type PulledUser = {
  ":user/display-name"?: string;
  ":user/email"?: string;
};

type PulledBlock = {
  ":block/string"?: string;
  ":block/order"?: number;
};
/* eslint-disable @typescript-eslint/naming-convention */

type MiniSearchDocument = SearchResult & {
  id: string;
};

export const stripTypePrefix = (title: string): string => {
  const match = title.match(/^\[\[.*?\]\]\s*-\s*(.*)/s);
  return match ? match[1] : title;
};

export const splitWithHighlights = (
  text: string,
  keywords: string[],
): { text: string; isMatch: boolean }[] => {
  if (!keywords.length) return [{ text, isMatch: false }];

  const escapedKeywords = keywords.map((keyword) =>
    keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const regex = new RegExp(`(${escapedKeywords.join("|")})`, "gi");
  const loweredKeywords = new Set(
    keywords.map((keyword) => keyword.toLowerCase()),
  );

  return text
    .split(regex)
    .filter(Boolean)
    .map((part) => ({
      text: part,
      isMatch: loweredKeywords.has(part.toLowerCase()),
    }));
};

export const formatMetadataDate = (value: string): string => {
  if (!value) return "Unknown";
  const numericValue = Number(value);
  const date = Number.isFinite(numericValue)
    ? new Date(numericValue)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const truncateText = (value: string, maxLength: number): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
};

const getAuthorName = (pulled: PulledNode): string =>
  pulled[":edit/user"]?.[":user/display-name"] ||
  pulled[":create/user"]?.[":user/display-name"] ||
  pulled[":edit/user"]?.[":user/email"] ||
  pulled[":create/user"]?.[":user/email"] ||
  "Unknown";

const getPulledTextLines = (pulled: PulledNode | null): string[] => {
  if (!pulled) return [];

  const ownText = pulled[":block/string"];
  const childLines = (pulled[":block/children"] ?? [])
    .sort((a, b) => (a[":block/order"] ?? 0) - (b[":block/order"] ?? 0))
    .map((child) => child[":block/string"] ?? "")
    .filter(Boolean);

  return [ownText, ...childLines].filter(
    (line): line is string =>
      typeof line === "string" && line.trim().length > 0,
  );
};

export const pullNodeContent = (
  uid: string,
  fallbackTitle: string,
): NodeContent | null => {
  try {
    const pulled = window.roamAlphaAPI.pull(
      "[:block/string :node/title {:block/children [:block/string :block/order]}]",
      [":block/uid", uid],
    ) as PulledNode | null;

    if (!pulled) return null;

    const lines = getPulledTextLines(pulled);
    const title =
      pulled[":node/title"] || pulled[":block/string"] || fallbackTitle;

    return {
      title,
      lines,
      excerpt: truncateText(lines.join(" "), EXCERPT_LENGTH),
    };
  } catch (error) {
    console.error("Error pulling node content:", error);
    return null;
  }
};

const queryNodesForType = async (
  node: DiscourseNode,
): Promise<SearchResult[]> => {
  if (!node.format) return [];

  try {
    const regex = getDiscourseNodeFormatExpression(node.format);
    const regexPattern = regex.source
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');

    const query = `[
      :find
        (pull ?node [:block/string :node/title :block/uid :create/time :edit/time {:create/user [:user/display-name :user/email]} {:edit/user [:user/display-name :user/email]}])
      :where
        [(re-pattern "${regexPattern}") ?title-regex]
        [?node :node/title ?node-title]
        [(re-find ?title-regex ?node-title)]
    ]`;

    const queryResults = (await window.roamAlphaAPI.data.async.fast.q(
      query,
    )) as [PulledNode][];

    return queryResults
      .map(([result]) => {
        const uid = result[":block/uid"];
        const title = result[":node/title"] || result[":block/string"] || "";
        if (!uid || !title) return null;

        return {
          uid,
          title,
          type: node.type,
          nodeTypeLabel: node.text,
          excerpt: "",
          createdAt: String(result[":create/time"] || ""),
          lastModified: String(
            result[":edit/time"] || result[":create/time"] || "",
          ),
          authorName: getAuthorName(result),
        };
      })
      .filter((result): result is SearchResult => !!result);
  } catch (error) {
    console.error(`Error querying for node type ${node.type}:`, error);
    throw error;
  }
};

export const buildSearchIndex = async (
  discourseNodes: DiscourseNode[],
): Promise<{
  miniSearch: MiniSearch<MiniSearchDocument>;
  results: SearchResult[];
}> => {
  const resultsByType = await Promise.all(
    discourseNodes.map(queryNodesForType),
  );
  const results = resultsByType.flat();

  const miniSearch = new MiniSearch<MiniSearchDocument>({
    fields: ["title", "nodeTypeLabel"],
    storeFields: ["uid", "title", "type", "nodeTypeLabel", "excerpt"],
    idField: "id",
  });

  miniSearch.addAll(results.map((result) => ({ ...result, id: result.uid })));

  return { miniSearch, results };
};

export const searchIndexedNodes = ({
  miniSearch,
  allResults,
  searchTerm,
}: {
  miniSearch: MiniSearch<MiniSearchDocument>;
  allResults: SearchResult[];
  searchTerm: string;
}): SearchResult[] => {
  const resultsByUid = new Map(
    allResults.map((result) => [result.uid, result]),
  );

  return miniSearch
    .search(searchTerm, {
      fields: ["title", "nodeTypeLabel"],
      fuzzy: 0.2,
      prefix: true,
      combineWith: "AND",
    })
    .filter((result) => result.score > MIN_SEARCH_SCORE)
    .slice(0, MAX_RESULTS)
    .map((result) => resultsByUid.get(String(result.id)))
    .filter((result): result is SearchResult => !!result);
};
