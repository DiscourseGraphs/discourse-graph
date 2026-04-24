import { DEFAULT_CANVAS_PAGE_FORMAT } from "..";
import {
  getGlobalSetting,
  type SettingsSnapshot,
} from "~/components/settings/utils/accessors";
import { GLOBAL_KEYS } from "~/components/settings/utils/settingKeys";

export const isCanvasPage = ({
  title,
  snapshot,
}: {
  title: string;
  snapshot?: SettingsSnapshot;
}) => {
  const format =
    (snapshot
      ? snapshot.globalSettings[GLOBAL_KEYS.canvasPageFormat]
      : getGlobalSetting<string>([GLOBAL_KEYS.canvasPageFormat])) ||
    DEFAULT_CANVAS_PAGE_FORMAT;
  const canvasRegex = new RegExp(`^${format}$`.replace(/\*/g, ".+"));
  return canvasRegex.test(title);
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
