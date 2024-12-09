import { PullBlock } from "roamjs-components/types";
import { getQueryPages } from "~/components/settings/QueryPagesPanel";
import { OnloadArgs } from "roamjs-components/types";

export const listActiveQueries = (extensionAPI: OnloadArgs["extensionAPI"]) =>
  (
    window.roamAlphaAPI.data.fast.q(
      `[:find (pull ?b [:block/uid]) :where [or-join [?b] 
               [and [?b :block/string ?s] [[clojure.string/includes? ?s "{{query block}}"]] ]
               ${getQueryPages(extensionAPI).map(
                 (p) =>
                   `[and [?b :node/title ?t] [[re-pattern "^${p.replace(
                     /\*/,
                     ".*",
                   )}$"] ?regex] [[re-find ?regex ?t]]]`,
               )}
          ]]`,
    ) as [PullBlock][]
  ).map((b) => ({ uid: b[0][":block/uid"] || "" }));
