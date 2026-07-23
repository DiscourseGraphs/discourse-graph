import type { TreeNode } from "roamjs-components/types";
import type { CrossAppNode } from "@repo/database/crossAppContracts";
import { buildFullMarkdown } from "./roamToCrossAppConverters";
import { contentTypes } from "@repo/content-model";

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
    contentType: contentTypes.roamMarkdown,
    value: buildFullMarkdown({ title, blocks }),
  },
};
