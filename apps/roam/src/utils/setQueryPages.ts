import { OnloadArgs } from "roamjs-components/types";
import {
  readPathValue,
  setPersonalSetting,
  type SettingsSnapshot,
} from "~/components/settings/utils/accessors";
import {
  PERSONAL_KEYS,
  QUERY_KEYS,
} from "~/components/settings/utils/settingKeys";

export const setInitialQueryPages = (
  onloadArgs: OnloadArgs,
  settingsSnapshot: SettingsSnapshot,
) => {
  // Legacy extensionAPI stored query-pages as string | string[] | Record<string, string>.
  // Coerce to string[] for backward compatibility with old stored formats.
  const raw = readPathValue(settingsSnapshot.personalSettings, [
    PERSONAL_KEYS.query,
    QUERY_KEYS.queryPages,
  ]) as string[] | string | Record<string, string> | undefined;
  const queryPageArray = Array.isArray(raw)
    ? raw
    : typeof raw === "string" && raw
      ? [raw]
      : [];
  if (!queryPageArray.includes("discourse-graph/queries/*")) {
    const updated = [...queryPageArray, "discourse-graph/queries/*"];
    void onloadArgs.extensionAPI.settings.set("query-pages", updated);
    setPersonalSetting([PERSONAL_KEYS.query, QUERY_KEYS.queryPages], updated);
  }
};
