import { OnloadArgs } from "roamjs-components/types";
import {
  getPersonalSetting,
  setPersonalSetting,
} from "~/components/settings/utils/accessors";

export const setQueryPages = (onloadArgs: OnloadArgs) => {
  const queryPageArray =
    getPersonalSetting<string[]>(["Query", "Query pages"]) ?? [];
  if (!queryPageArray.includes("discourse-graph/queries/*")) {
    const updated = [...queryPageArray, "discourse-graph/queries/*"];
    void onloadArgs.extensionAPI.settings.set("query-pages", updated);
    setPersonalSetting(["Query", "Query pages"], updated);
  }
};
