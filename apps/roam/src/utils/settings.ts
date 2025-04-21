import getExtensionAPI from "roamjs-components/util/extensionApiContext";
import localStorageGet from "roamjs-components/util/localStorageGet";

export function getSetting<T>(key: string, defaultValue?: T): T {
  const extensionAPI = getExtensionAPI();
  const value = extensionAPI.settings.get(key);

  if (value !== undefined && value !== null) {
    return value as T;
  }

  // Fall back to localStorage for backward compatibility then migrate to extension settings
  const roamjsKey = `roamjs:${key}`;
  const roamjsKey2 = `roamjs:${key}:${window.roamAlphaAPI.graph.name}`;
  const localValue =
    localStorageGet(key) ||
    localStorageGet(roamjsKey) ||
    localStorageGet(roamjsKey2);

  if (localValue !== null && localValue !== undefined) {
    extensionAPI.settings.set(key, localValue);
    localStorage.removeItem(key);
    localStorage.removeItem(roamjsKey);
    localStorage.removeItem(roamjsKey2);
    return localValue as T;
  }

  return defaultValue as T;
}

export function setSetting<T>(key: string, value: T): void {
  const extensionAPI = getExtensionAPI();
  extensionAPI.settings.set(key, value);
}