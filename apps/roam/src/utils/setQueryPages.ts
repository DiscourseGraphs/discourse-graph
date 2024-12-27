import { OnloadArgs } from "roamjs-components/types";

export const setQueryPages = (onloadArgs: OnloadArgs) => {
  const queryPages = onloadArgs.extensionAPI.settings.get("query-pages");
  const queryPageArray = Array.isArray(queryPages)
    ? queryPages
    : typeof queryPages === "object"
      ? []
      : typeof queryPages === "string" && queryPages
        ? [queryPages]
        : [];
  if (!queryPageArray.includes("discourse-graph/queries/*")) {
    onloadArgs.extensionAPI.settings.set("query-pages", [
      ...queryPageArray,
      "discourse-graph/queries/*",
    ]);
  }
};
