import { DEFAULT_CANVAS_PAGE_FORMAT } from "..";
import { getFormattedConfigTree } from "./discourseConfigRef";

export const isCanvasPage = ({ title }: { title: string }) => {
  const { canvasPageFormat } = getFormattedConfigTree();
  const format = canvasPageFormat.value || DEFAULT_CANVAS_PAGE_FORMAT;
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
