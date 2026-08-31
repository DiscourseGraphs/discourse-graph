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
