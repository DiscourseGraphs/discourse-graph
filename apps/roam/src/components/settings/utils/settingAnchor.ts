const SETTING_ANCHOR_ATTRIBUTE = "data-setting-id";

/** Addressed by setting key, not tab, so the anchor survives a row moving tabs. */
export const settingAnchor = (
  settingKeys: string[],
): Record<string, string> => ({
  [SETTING_ANCHOR_ATTRIBUTE]: settingKeys.join("/"),
});
