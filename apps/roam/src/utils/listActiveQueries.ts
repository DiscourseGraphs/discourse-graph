import { PullBlock } from "roamjs-components/types";
import { getQueryPages } from "~/components/settings/utils/accessors";

export const listActiveQueries = () =>
  (
    window.roamAlphaAPI.data.fast.q(
      `[:find (pull ?b [:block/uid]) :where [or-join [?b]
               [and [?b :block/string ?s] [[clojure.string/includes? ?s "{{query block}}"]] ]
               ${getQueryPages().map(
                 (p) =>
                   `[and [?b :node/title ?t] [[re-pattern "^${p.replace(
                     /\*/,
                     ".*",
                   )}$"] ?regex] [[re-find ?regex ?t]]]`,
               )}
          ]]`,
    ) as [PullBlock][]
  ).map((b) => ({ uid: b[0][":block/uid"] || "" }));
