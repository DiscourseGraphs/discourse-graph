import getDiscourseNodeFormatExpression from "./getDiscourseNodeFormatExpression";
import { type DiscourseNode } from "./getDiscourseNodes";
import { type Result } from "./types";

export const getAllDiscourseNodeInstances = async (
  nodeTypes: DiscourseNode[],
): Promise<(Result & { discourseNodeType: string })[]> => {
  if (!nodeTypes.length) return [];

  const typeMatchers = nodeTypes.map((node) => ({
    node,
    regex: getDiscourseNodeFormatExpression(node.format),
  }));

  const regexPattern = typeMatchers
    .map(({ regex }) => `(?:${regex.source})`)
    .join("|")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');

  const query = `[
    :find ?node-title ?uid
    :keys text uid
    :where
      [(re-pattern "${regexPattern}") ?title-regex]
      [?node :node/title ?node-title]
      [(re-find ?title-regex ?node-title)]
      [?node :block/uid ?uid]
  ]`;

  const allPages = (await window.roamAlphaAPI.data.backend.q(
    query,
  )) as unknown[] as { text: string; uid: string }[];

  return allPages.flatMap((page) => {
    for (const { node, regex } of typeMatchers) {
      if (regex.test(page.text)) {
        return [
          { ...page, discourseNodeType: node.type } as Result & {
            discourseNodeType: string;
          },
        ];
      }
    }
    return [];
  });
};
