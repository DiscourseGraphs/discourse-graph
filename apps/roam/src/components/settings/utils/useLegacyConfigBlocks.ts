import { useMemo } from "react";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import discourseConfigRef from "~/utils/discourseConfigRef";
import {
  getUidAndBooleanSetting,
  getUidAndStringSetting,
} from "~/utils/getExportSettings";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/data/constants";

/**
 * The three settings that still mirror into the legacy Roam block tree, keyed
 * by the exact block text that discourseConfigRef.ts reads them back by. Text
 * and order live together here so the panels writing under one parentUid can
 * neither collide on order nor drift from the reader's spelling.
 */
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

/**
 * Panels only mirror when given uid/parentUid/order, and `Use new settings
 * store = false` (the shipping default) reads from that tree, so dropping any
 * of these breaks the setting silently.
 *
 * Reads the config tree as-is: every writer in the dialog refreshes it after
 * writing and the dialog refreshes it again on close, so a refresh here would
 * only repeat that work on each tab visit.
 */
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
