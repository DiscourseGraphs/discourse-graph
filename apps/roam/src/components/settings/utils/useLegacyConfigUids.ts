import { useMemo } from "react";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import discourseConfigRef from "~/utils/discourseConfigRef";
import refreshConfigTree from "~/utils/refreshConfigTree";
import {
  getUidAndBooleanSetting,
  getUidAndStringSetting,
} from "~/utils/getExportSettings";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/data/constants";

/** Shared so the three tabs writing under this parentUid cannot collide on order. */
export const LEGACY_CONFIG_ORDER = {
  trigger: 0,
  canvasPageFormat: 1,
  leftSidebarFlag: 2,
} as const;

type LegacyConfigUids = {
  settingsUid: string;
  triggerUid: string | undefined;
  canvasPageFormatUid: string | undefined;
  leftSidebarEnabledUid: string | undefined;
};

/**
 * Uids of the legacy blocks these settings mirror into. Panels only mirror when
 * given uid/parentUid/order, and `Use new settings store = false` (the shipping
 * default) reads from that tree, so dropping them breaks the setting silently.
 */
export const useLegacyConfigUids = (): LegacyConfigUids =>
  useMemo(() => {
    refreshConfigTree();
    const tree = discourseConfigRef.tree;
    return {
      settingsUid: getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE),
      triggerUid: getUidAndStringSetting({ tree, text: "trigger" }).uid,
      canvasPageFormatUid: getUidAndStringSetting({
        tree,
        text: "Canvas Page Format",
      }).uid,
      leftSidebarEnabledUid: getUidAndBooleanSetting({
        tree,
        text: "(BETA) Left Sidebar",
      }).uid,
    };
  }, []);
