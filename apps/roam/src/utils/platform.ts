// Mirrors Blueprint's hotkeyParser so our hints match its hotkey labels.
// roamAlphaAPI.platform can't substitute: it has no macOS flag. navigator.platform
// is deprecated, but userAgentData is missing in Safari and Firefox.
export const isMacOS = (): boolean => {
  const platform =
    typeof navigator !== "undefined" ? navigator.platform : undefined;
  return platform == null ? false : /Mac|iPod|iPhone|iPad/.test(platform);
};
