import getExtensionAPI from "roamjs-components/util/extensionApiContext";

export const getSetting = <T>(key: string, defaultValue?: T): T => {
  const extensionAPI = getExtensionAPI();
  const value = extensionAPI.settings.get(key);

  if (value !== undefined && value !== null) {
    return value as T;
  }
  return defaultValue as T;
};

export const setSetting = async <T>(key: string, value: T): Promise<void> => {
  const extensionAPI = getExtensionAPI();
  await extensionAPI.settings.set(key, value);
};
