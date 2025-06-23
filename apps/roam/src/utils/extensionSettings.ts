import getExtensionAPI from "roamjs-components/util/extensionApiContext";

export const getSetting = <T>(key: string, defaultValue: T = null as T): T => {
  const extensionAPI = getExtensionAPI();
  const value = extensionAPI.settings.get(key) as T;
  return value ?? defaultValue;
};

export const setSetting = <T>(key: string, value: T): void => {
  const extensionAPI = getExtensionAPI();
  extensionAPI.settings.set(key, value);
};
