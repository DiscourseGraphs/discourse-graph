import { DEFAULT_CANVAS_PAGE_FORMAT } from "..";
import {
  getGlobalSetting,
  type SettingsSnapshot,
} from "~/components/settings/utils/accessors";
import { GLOBAL_KEYS } from "~/components/settings/utils/settingKeys";

const getCanvasPageRegex = (snapshot?: SettingsSnapshot): RegExp => {
  const format =
    (snapshot
      ? snapshot.globalSettings[GLOBAL_KEYS.canvasPageFormat]
      : getGlobalSetting<string>([GLOBAL_KEYS.canvasPageFormat])) ||
    DEFAULT_CANVAS_PAGE_FORMAT;
  return new RegExp(`^${format}$`.replace(/\*/g, ".+"));
};

export const isCanvasPage = ({
  title,
  snapshot,
}: {
  title: string;
  snapshot?: SettingsSnapshot;
}) => {
  return getCanvasPageRegex(snapshot).test(title);
};

export const isCurrentPageCanvas = ({
  title,
  h1,
  snapshot,
}: {
  title: string;
  h1: HTMLHeadingElement;
  snapshot: SettingsSnapshot;
}) => {
  return isCanvasPage({ title, snapshot }) && !!h1.closest(".roam-article");
};

export const isSidebarCanvas = ({
  title,
  h1,
  snapshot,
}: {
  title: string;
  h1: HTMLHeadingElement;
  snapshot: SettingsSnapshot;
}) => {
  return (
    isCanvasPage({ title, snapshot }) && !!h1.closest(".rm-sidebar-outline")
  );
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
