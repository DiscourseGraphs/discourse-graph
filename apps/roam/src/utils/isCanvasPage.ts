import { DEFAULT_CANVAS_PAGE_FORMAT } from "..";
import { getFormattedConfigTree } from "./discourseConfigRef";

const getCanvasPageRegex = (): RegExp => {
  const { canvasPageFormat } = getFormattedConfigTree();
  const format = canvasPageFormat.value || DEFAULT_CANVAS_PAGE_FORMAT;
  const escaped = format
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\*/g, ".+");
  return new RegExp(`^${escaped}$`);
};

export const isCanvasPage = ({ title }: { title: string }) => {
  return getCanvasPageRegex().test(title);
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

export const getCanvasPageTitles = async (): Promise<string[]> => {
  const regex = getCanvasPageRegex();
  const escaped = regex.source.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  try {
    const results = (await window.roamAlphaAPI.data.async.fast.q(`[
      :find ?title
      :where
        [(re-pattern "${escaped}") ?regex]
        [?node :node/title ?title]
        [(re-find ?regex ?title)]
    ]`)) as [string][];
    return results.map(([title]) => title).sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
};
