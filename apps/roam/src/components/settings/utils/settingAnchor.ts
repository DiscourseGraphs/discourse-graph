const SETTING_ANCHOR_ATTRIBUTE = "data-setting-id";

/**
 * Marks a setting row so it can be scrolled to by setting key. Addressing rows
 * by key rather than by tab keeps the address stable when a setting moves tabs.
 */
export const settingAnchor = (
  settingKeys: string[],
): Record<string, string> => ({
  [SETTING_ANCHOR_ATTRIBUTE]: settingKeys.join("/"),
});

/** Setting keys are authored identifiers, so quoting is enough to build a selector. */
export const settingAnchorSelector = (anchorId: string): string =>
  `[${SETTING_ANCHOR_ATTRIBUTE}="${anchorId.replace(/"/g, '\\"')}"]`;

export const SETTING_ANCHOR_FLASH_CLASS = "dg-setting-row--flash";
