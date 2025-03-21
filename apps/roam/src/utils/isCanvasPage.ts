import { OnloadArgs } from "roamjs-components/types";
import { DEFAULT_CANVAS_PAGE_FORMAT } from "..";
import type { RoamBasicNode } from "roamjs-components/types";
import { getUidAndStringSetting } from "./getExportSettings";

const configTreeRef: {
  tree: RoamBasicNode[];
  nodes: { [uid: string]: { text: string; children: RoamBasicNode[] } };
} = { tree: [], nodes: {} };

export const isCanvasPage = ({ title }: { title: string }) => {
  const formatInSettings = getUidAndStringSetting({
    tree: configTreeRef.tree,
    text: "Canvas Page Format",
  });
  console.log("formatInSettings", formatInSettings);
  const format = formatInSettings || DEFAULT_CANVAS_PAGE_FORMAT;
  const canvasRegex = new RegExp(`^${format}$`.replace(/\*/g, ".+"));
  return canvasRegex.test(title);
};

export const isCurrentPageCanvas = ({
  title,
  h1,
}: {
  title: string;
  h1: HTMLHeadingElement;
}) => {
  return isCanvasPage({ title }) && !!h1.closest(".roam-article");
};
