import type { TreeNode } from "roamjs-components/types";
import type { CrossAppNode } from "@repo/database/crossAppNodeContract";
import { buildFullMarkdown } from "./convertRoamNodeToFullContent";

/**
 * Small typed example for ENG-1848/ENG-1852 full markdown validation. The Roam
 * app has no unit-test runner, so this keeps a compact in-memory tree that
 * type-checks the generated markdown against the shared cross-app contract.
 */

const block = (text: string, children: TreeNode[] = []): TreeNode => ({
  text,
  children,
  order: 0,
  parents: [],
  uid: "",
  heading: 0,
  open: true,
  viewType: "bullet",
  blockViewType: "outline",
  editTime: new Date(0),
  textAlign: "left",
  props: { imageResize: {}, iframe: {} },
});

const title = "Sleep improves memory consolidation";

const blocks: TreeNode[] = [
  block(
    "Multiple studies show that sleep after learning strengthens memory traces.",
  ),
  block("Supporting evidence:", [block("[[EVD]] - Rasch & Born 2013")]),
];

export const roamClaimFullMarkdownSimpleExample: {
  title: string;
  blocks: TreeNode[];
  full: CrossAppNode["content"]["full"];
} = {
  title,
  blocks,
  full: {
    format: "text/markdown",
    value: buildFullMarkdown({ title, blocks }),
  },
};
