import { OnloadArgs } from "roamjs-components/types";
import {
  getPersonalSetting,
  setPersonalSetting,
} from "~/components/settings/utils/accessors";

export const setQueryPages = (onloadArgs: OnloadArgs) => {
  const queryPages = getPersonalSetting<string[]>(["Query", "Query pages"]);
  const queryPageArray = Array.isArray(queryPages) ? queryPages : [];
  if (!queryPageArray.includes("discourse-graph/queries/*")) {
    const updated = [...queryPageArray, "discourse-graph/queries/*"];
    void onloadArgs.extensionAPI.settings.set("query-pages", updated);
    setPersonalSetting(["Query", "Query pages"], updated);
  }
};
