import { useEffect, useState } from "react";
import getDiscourseNodes, { DiscourseNode } from "~/utils/getDiscourseNodes";
import findDiscourseNode from "~/utils/findDiscourseNode";
import matchDiscourseNode from "~/utils/matchDiscourseNode";
import getDiscourseNodeFormatExpression from "~/utils/getDiscourseNodeFormatExpression";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";

export type NodeContext = {
  pageUid: string | null;
  searchText: string;
};

const extractContentFromTitle = (
  title: string,
  node: DiscourseNode,
): string => {
  if (!node.format) return title;
  const placeholderRegex = /{([\w\d-]+)}/g;
  const placeholders: string[] = [];
  let placeholderMatch: RegExpExecArray | null = null;
  while ((placeholderMatch = placeholderRegex.exec(node.format))) {
    placeholders.push(placeholderMatch[1]);
  }
  const expression = getDiscourseNodeFormatExpression(node.format);
  const expressionMatch = expression.exec(title);
  if (!expressionMatch || expressionMatch.length <= 1) {
    return title;
  }
  const contentIndex = placeholders.findIndex(
    (name) => name.toLowerCase() === "content",
  );
  if (contentIndex >= 0) {
    return expressionMatch[contentIndex + 1]?.trim() || title;
  }
  return expressionMatch[1]?.trim() || title;
};

export const useNodeContext = (pageTitle: string): NodeContext | null => {
  const [nodeContext, setNodeContext] = useState<NodeContext | null>(null);

  useEffect(() => {
    const discourseNodes = getDiscourseNodes();
    const pageUid = getPageUidByPageTitle(pageTitle) || null;
    let matchedNode: DiscourseNode | null = null;

    if (pageUid) {
      const found = findDiscourseNode(pageUid, discourseNodes);
      if (found) {
        matchedNode = found;
      }
    }

    if (!matchedNode) {
      matchedNode =
        discourseNodes.find((node) =>
          matchDiscourseNode({ ...node, title: pageTitle }),
        ) || null;
    }

    if (matchedNode) {
      const searchText = extractContentFromTitle(pageTitle, matchedNode);
      setNodeContext({ searchText, pageUid });
    } else {
      setNodeContext(null);
    }
  }, [pageTitle]);

  return nodeContext;
};
