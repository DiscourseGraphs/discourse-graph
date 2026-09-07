import { useMemo } from "react";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import discourseConfigRef from "~/utils/discourseConfigRef";
import {
  getUidAndBooleanSetting,
  getUidAndStringSetting,
} from "~/utils/getExportSettings";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/data/constants";

/** Block text is what discourseConfigRef.ts reads back by; kept with `order` so
 *  panels writing under one parentUid can neither collide nor drift. */
const LEGACY_CONFIG_BLOCKS = {
  trigger: { blockKey: "trigger", order: 0 },
  canvasPageFormat: { blockKey: "Canvas Page Format", order: 1 },
  leftSidebarFlag: { blockKey: "(BETA) Left Sidebar", order: 2 },
} as const;

/** Spreads straight onto a panel's block-sync props. */
export type LegacyConfigBlock = {
  blockKey: string;
  order: number;
  uid: string | undefined;
  parentUid: string;
};

type LegacyConfigBlocks = Record<
  keyof typeof LEGACY_CONFIG_BLOCKS,
  LegacyConfigBlock
>;

/** `Use new settings store = false` (the default) still reads this tree. No
 *  refresh here: every writer and the dialog's close already refresh it. */
export const useLegacyConfigBlocks = (): LegacyConfigBlocks =>
  useMemo(() => {
    const tree = discourseConfigRef.tree;
    const parentUid = getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE);
    const { trigger, canvasPageFormat, leftSidebarFlag } = LEGACY_CONFIG_BLOCKS;
    return {
      trigger: {
        ...trigger,
        parentUid,
        uid: getUidAndStringSetting({ tree, text: trigger.blockKey }).uid,
      },
      canvasPageFormat: {
        ...canvasPageFormat,
        parentUid,
        uid: getUidAndStringSetting({ tree, text: canvasPageFormat.blockKey })
          .uid,
      },
      leftSidebarFlag: {
        ...leftSidebarFlag,
        parentUid,
        uid: getUidAndBooleanSetting({ tree, text: leftSidebarFlag.blockKey })
          .uid,
      },
    };
  }, []);
