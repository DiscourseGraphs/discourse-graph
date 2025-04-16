import getExtensionAPI from "roamjs-components/util/extensionApiContext";
import localStorageGet from "roamjs-components/util/localStorageGet";
import localStorageSet from "roamjs-components/util/localStorageSet";

/**
 * Get a setting from the extension API, with fallback to localStorage for backward compatibility
 */
export function getSetting<T>(key: string, defaultValue?: T): T {
  const extensionAPI = getExtensionAPI();

  // Special handling for oauth tokens
  if (key === "oauth-github") {
    // For oauth tokens, try localStorage first for backward compatibility
    const localValue = localStorageGet(key);
    if (localValue !== null && localValue !== undefined && localValue !== "") {
      console.log(`Found GitHub token in localStorage: ${typeof localValue}`);

      // Migrate to extension settings if found
      extensionAPI.settings.set(key, localValue);
      return localValue as T;
    }

    // Then try extension settings
    const value = extensionAPI.settings.get(key);
    console.log(`Extension API GitHub token: ${typeof value}`);

    if (value !== undefined && value !== null && value !== "") {
      return value as T;
    }

    return defaultValue as T;
  }

  // Regular path for non-oauth settings
  // Try to get from extension settings first
  const value = extensionAPI.settings.get(key);

  if (value !== undefined && value !== null) {
    return value as T;
  }

  // Fall back to localStorage for backward compatibility
  const localValue = localStorageGet(key);

  // If found in localStorage, migrate it to extension settings
  if (localValue !== null && localValue !== undefined) {
    extensionAPI.settings.set(key, localValue);
    return localValue as T;
  }

  return defaultValue as T;
}

/**
 * Set a setting in the extension API and remove it from localStorage
 */
export function setSetting<T>(key: string, value: T): void {
  const extensionAPI = getExtensionAPI();
  extensionAPI.settings.set(key, value);

  // Clean up localStorage if it exists there
  if (localStorageGet(key) !== null) {
    localStorageSet(key, "");
  }
}

/**
 * Special handling for settings with roamjs: prefix
 */
export function getRoamJSSetting<T>(key: string, defaultValue?: T): T {
  const fullKey = `roamjs:${key}`;

  // Check localStorage directly for these special keys
  const localValue = localStorage.getItem(fullKey);

  if (localValue !== null) {
    try {
      return JSON.parse(localValue) as T;
    } catch {
      return localValue as unknown as T;
    }
  }

  return getSetting<T>(key, defaultValue);
}

/**
 * Set a roamjs: prefixed setting
 */
export function setRoamJSSetting<T>(key: string, value: T): void {
  const fullKey = `roamjs:${key}`;
  setSetting(key, value);

  // Clean up localStorage
  localStorage.removeItem(fullKey);
}
