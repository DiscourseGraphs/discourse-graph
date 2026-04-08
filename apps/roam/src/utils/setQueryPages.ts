import { OnloadArgs } from "roamjs-components/types";
import {
  setPersonalSetting,
  type SettingsSnapshot,
} from "~/components/settings/utils/accessors";
import {
  PERSONAL_KEYS,
  QUERY_KEYS,
} from "~/components/settings/utils/settingKeys";

export const setInitialQueryPages = (
  onloadArgs: OnloadArgs,
  snapshot: SettingsSnapshot,
) => {
  const queryPageArray =
    snapshot.personalSettings[PERSONAL_KEYS.query][QUERY_KEYS.queryPages];
  if (!queryPageArray.includes("discourse-graph/queries/*")) {
    const updated = [...queryPageArray, "discourse-graph/queries/*"];
    void onloadArgs.extensionAPI.settings.set("query-pages", updated);
    setPersonalSetting([PERSONAL_KEYS.query, QUERY_KEYS.queryPages], updated);
  }
};
