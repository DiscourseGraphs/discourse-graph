import { useExtensionAPI } from "roamjs-components/components/ExtensionApiContext";

export type SuggestionsDisplaySettings = {
  split: boolean;
  overlay: boolean;
  inline: boolean;
};

/**
 * Hook to get the current display mode for Discourse Suggestions.
 * Defaults to "overlay" if no setting is found.
 */
const useSuggestionsDisplaySettings = (): SuggestionsDisplaySettings => {
  const extensionAPI = useExtensionAPI();
  const settings = {
    split: Boolean(extensionAPI?.settings.get("suggestion-display-split-view")),
    overlay: Boolean(extensionAPI?.settings.get("suggestion-display-overlay")),
    inline: Boolean(extensionAPI?.settings.get("suggestion-display-inline")),
  } as SuggestionsDisplaySettings;

  // If none selected, default to overlay
  if (!settings.split && !settings.inline && !settings.overlay) {
    settings.overlay = true;
  }

  return settings;
};

export default useSuggestionsDisplaySettings;
