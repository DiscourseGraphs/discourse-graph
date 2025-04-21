import getExtensionAPI from "roamjs-components/util/extensionApiContext";

export function getSetting<T>(key: string, defaultValue?: T): T {
  const extensionAPI = getExtensionAPI();
  const value = extensionAPI.settings.get(key);

  if (value !== undefined && value !== null) {
    return value as T;
  }
  return defaultValue as T;
}

export function setSetting<T>(key: string, value: T): void {
  const extensionAPI = getExtensionAPI();
  extensionAPI.settings.set(key, value);
}
