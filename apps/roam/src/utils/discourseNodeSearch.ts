import { type DiscourseNode } from "~/utils/getDiscourseNodes";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import { getDiscourseNodeFormatExpression } from "@repo/database/lib/getDiscourseNodeFormatExpression";

export const DISCOURSE_NODE_MIN_SEARCH_SCORE = 0.1;

export const DISCOURSE_NODE_MINI_SEARCH_OPTIONS = {
  fuzzy: 0.2,
  prefix: true,
  combineWith: "AND" as const,
};

export const BASIC_DISCOURSE_NODE_PULL =
  "[:block/string :node/title :block/uid]";

export const DISCOURSE_NODE_SEARCH_METADATA_PULL = `[:block/string :node/title :block/uid :create/time :edit/time {:create/user [:user/display-name :user/email]} {:edit/user [:user/display-name :user/email]}]`;

export const CANDIDATE_BLOCK_SEARCH_PULL = `[:block/string :block/uid :create/time :edit/time {:create/user [:user/display-name :user/email]} {:edit/user [:user/display-name :user/email]} {:block/page [:node/title :block/uid]}]`;

/* eslint-disable @typescript-eslint/naming-convention */
type PulledDiscourseUser = {
  ":user/display-name"?: string;
  ":user/email"?: string;
};

type PulledDiscourseBlock = {
  ":block/string"?: string;
  ":block/order"?: number;
};

export type PulledDiscourseNode = {
  [key: string]: unknown;
  ":block/string"?: string;
  ":block/uid"?: string;
  ":node/title"?: string;
  ":block/children"?: PulledDiscourseBlock[];
  ":create/time"?: string | number;
  ":edit/time"?: string | number;
  ":create/user"?: PulledDiscourseUser;
  ":edit/user"?: PulledDiscourseUser;
  ":block/page"?: { ":node/title"?: string; ":block/uid"?: string };
};
/* eslint-enable @typescript-eslint/naming-convention */

export const escapeRegexPatternForDatalog = (regex: RegExp): string =>
  regex.source.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

export const buildDiscourseNodesByFormatQuery = ({
  regexPattern,
  pullExpression,
}: {
  regexPattern: string;
  pullExpression: string;
}): string => `[
  :find
    (pull ?node ${pullExpression})
  :where
    [(re-pattern "${regexPattern}") ?title-regex]
    [?node :node/title ?node-title]
    [(re-find ?title-regex ?node-title)]
]`;

export const getPulledDiscourseNodeUid = (
  node: PulledDiscourseNode,
): string | undefined => {
  const namespacedUid = node[":block/uid"];
  if (typeof namespacedUid === "string") return namespacedUid;

  const legacyUid = node.uid;
  return typeof legacyUid === "string" ? legacyUid : undefined;
};

export const getPulledDiscourseNodeTitle = (
  node: PulledDiscourseNode,
): string => {
  const namespacedTitle =
    node[":node/title"] || node[":block/string"] || undefined;
  if (typeof namespacedTitle === "string") return namespacedTitle;

  const legacyTitle = node.title || node.string;
  return typeof legacyTitle === "string" ? legacyTitle : "";
};

export const getPulledDiscourseNodeAuthorName = (
  node: PulledDiscourseNode,
): string =>
  node[":edit/user"]?.[":user/display-name"] ||
  node[":create/user"]?.[":user/display-name"] ||
  node[":edit/user"]?.[":user/email"] ||
  node[":create/user"]?.[":user/email"] ||
  "Unknown";

export const queryDiscourseNodesByFormat = async ({
  node,
  pullExpression = BASIC_DISCOURSE_NODE_PULL,
}: {
  node: DiscourseNode;
  pullExpression?: string;
}): Promise<PulledDiscourseNode[]> => {
  if (!node.format) return [];

  const regex = getDiscourseNodeFormatExpression(node.format);
  const regexPattern = escapeRegexPatternForDatalog(regex);
  const query = buildDiscourseNodesByFormatQuery({
    regexPattern,
    pullExpression,
  });

  const queryResults = (await window.roamAlphaAPI.data.async.fast.q(query)) as [
    PulledDiscourseNode,
  ][];

  return queryResults.map(([result]) => result);
};

export const hasCandidateTag = (
  node: DiscourseNode,
): node is DiscourseNode & { tag: string } => !!node.tag?.trim();

// Matches the "is a candidate" datalog translator: one leading "#", exact title.
export const getCandidateTagTitle = (tag: string): string =>
  tag.trim().replace(/^#/, "");

export const buildCandidateBlocksByTagQuery = ({
  tagTitle,
  pullExpression,
}: {
  tagTitle: string;
  pullExpression: string;
}): string => `[
  :find
    (pull ?block ${pullExpression})
  :where
    [?tag :node/title "${normalizePageTitle(tagTitle)}"]
    [?block :block/refs ?tag]
]`;

export const queryCandidateBlocksByTag = async ({
  node,
  pullExpression = BASIC_DISCOURSE_NODE_PULL,
}: {
  node: DiscourseNode & { tag: string };
  pullExpression?: string;
}): Promise<PulledDiscourseNode[]> => {
  const query = buildCandidateBlocksByTagQuery({
    tagTitle: getCandidateTagTitle(node.tag),
    pullExpression,
  });
  const queryResults = (await window.roamAlphaAPI.data.async.fast.q(query)) as [
    PulledDiscourseNode,
  ][];

  return queryResults.map(([result]) => result);
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const stripCandidateTags = ({
  text,
  tagTitles,
}: {
  text: string;
  tagTitles: string[];
}): string =>
  tagTitles
    .reduce((stripped, tagTitle) => {
      const escaped = escapeRegExp(tagTitle);
      return stripped.replace(
        new RegExp(`#?\\[\\[${escaped}\\]\\]|#${escaped}(?![\\w-])`, "g"),
        "",
      );
    }, text)
    .replace(/\s+/g, " ")
    .trim();

export const queryDiscourseNodesByFormatSync = ({
  node,
  pullExpression = BASIC_DISCOURSE_NODE_PULL,
}: {
  node: DiscourseNode;
  pullExpression?: string;
}): PulledDiscourseNode[] => {
  if (!node.format) return [];

  try {
    const regex = getDiscourseNodeFormatExpression(node.format);
    const regexPattern = escapeRegexPatternForDatalog(regex);
    const query = buildDiscourseNodesByFormatQuery({
      regexPattern,
      pullExpression,
    });

    const queryResults = window.roamAlphaAPI.q(query) as [
      PulledDiscourseNode,
    ][];

    return queryResults.map(([result]) => result);
  } catch (error) {
    console.error(`Error querying for node type ${node.type}:`, error);
    console.error("Node format:", node.format);
    return [];
  }
};
