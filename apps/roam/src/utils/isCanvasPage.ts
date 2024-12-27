import { OnloadArgs } from "roamjs-components/types";
import { DEFAULT_CANVAS_PAGE_FORMAT } from "..";

export const isCanvasPage = ({
  title,
  extensionAPI,
}: {
  title: string;
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  const formatInSettings = extensionAPI.settings.get("canvas-page-format");
  const format = formatInSettings || DEFAULT_CANVAS_PAGE_FORMAT;
  const canvasRegex = new RegExp(`^${format}$`.replace(/\*/g, ".+"));
  return canvasRegex.test(title);
};

export const isCurrentPageCanvas = ({
  title,
  h1,
  onloadArgs,
}: {
  title: string;
  h1: HTMLHeadingElement;
  onloadArgs: OnloadArgs;
}) => {
  const { extensionAPI } = onloadArgs;
  return isCanvasPage({ title, extensionAPI }) && !!h1.closest(".roam-article");
};
