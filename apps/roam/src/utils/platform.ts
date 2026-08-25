// Mirrors the check in Blueprint's hotkeyParser so our own hints agree with the
// hotkey labels Blueprint renders. navigator.platform is deprecated in favour of
// userAgentData, but that is unavailable in Safari and Firefox.
// roamAlphaAPI.platform cannot substitute for this: it exposes only
// isDesktop/isIOS/isMobile/isMobileApp/isPC/isTouchDevice, none of which
// separate macOS from Windows or Linux.
export const isMacOS = (): boolean => {
  const platform =
    typeof navigator !== "undefined" ? navigator.platform : undefined;
  return platform == null ? false : /Mac|iPod|iPhone|iPad/.test(platform);
};
