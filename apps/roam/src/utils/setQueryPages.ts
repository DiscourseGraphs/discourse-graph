import { OnloadArgs } from "roamjs-components/types";
import {
  getPersonalSetting,
  setPersonalSetting,
} from "~/components/settings/utils/accessors";

export const setInitialQueryPages = (onloadArgs: OnloadArgs) => {
  // Legacy extensionAPI stored query-pages as string | string[] | Record<string, string>.
  // Coerce to string[] for backward compatibility with old stored formats.
  const raw = getPersonalSetting<string[] | string | Record<string, string>>([
    "Query",
    "Query pages",
  ]);
  const queryPageArray = Array.isArray(raw)
    ? raw
    : typeof raw === "string" && raw
      ? [raw]
      : [];
  if (!queryPageArray.includes("discourse-graph/queries/*")) {
    const updated = [...queryPageArray, "discourse-graph/queries/*"];
    void onloadArgs.extensionAPI.settings.set("query-pages", updated);
    setPersonalSetting(["Query", "Query pages"], updated);
  }
};
