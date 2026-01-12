import { DEFAULT_CANVAS_PAGE_FORMAT } from "..";
import { getGlobalSetting } from "~/components/settings/utils/accessors";

export const isCanvasPage = ({ title }: { title: string }) => {
  const format =
    getGlobalSetting<string>(["Canvas Page Format"]) ||
    DEFAULT_CANVAS_PAGE_FORMAT;
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

export const isSidebarCanvas = ({
  title,
  h1,
}: {
  title: string;
  h1: HTMLHeadingElement;
}) => {
  return isCanvasPage({ title }) && !!h1.closest(".rm-sidebar-outline");
};
