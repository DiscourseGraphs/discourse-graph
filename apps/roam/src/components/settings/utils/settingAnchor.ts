const SETTING_ANCHOR_ATTRIBUTE = "data-setting-id";

/** Addressed by setting key, not tab, so the anchor survives a row moving tabs. */
export const settingAnchor = (
  settingKeys: string[],
): Record<string, string> => ({
  [SETTING_ANCHOR_ATTRIBUTE]: settingKeys.join("/"),
});

/** Setting keys are authored identifiers, so quoting is enough to build a selector. */
export const settingAnchorSelector = (anchorId: string): string =>
  `[${SETTING_ANCHOR_ATTRIBUTE}="${anchorId.replace(/"/g, '\\"')}"]`;

export const SETTING_ANCHOR_FLASH_CLASS = "dg-setting-row--flash";
