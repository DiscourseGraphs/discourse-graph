import type { TreeNode } from "roamjs-components/types";
import type { CrossAppNode } from "@repo/database/crossAppNodeContract";
import { buildFullMarkdown } from "./convertRoamNodeToFullContent";

/**
 * Reference fixture for ENG-1848 ("tests or fixtures cover representative Roam
 * block content becoming `full` markdown"). The Roam app has no unit-test
 * runner, so this exercises the real `buildFullMarkdown` transform on an
 * in-memory Roam page tree and types the result against the final ENG-1847
 * `CrossAppNode.content.full` contract. Downstream importer validation
 * (ENG-1857) can assert against
 * `roamClaimFullMarkdownFixture.full.value`, which evaluates to:
 *
 *   # Sleep improves memory consolidation
 *
 *   - Multiple studies show that sleep after learning strengthens memory traces.
 *   - Supporting evidence:
 *       - [[EVD]] - Rasch & Born 2013
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

export const roamClaimFullMarkdownFixture: {
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
