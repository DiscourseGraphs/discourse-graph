import { PullBlock } from "roamjs-components/types";
import { getQueryPages } from "~/components/settings/QueryPagesPanel";
import { QUERY_BLOCK_MARKER } from "./getLeftSidebarSettings";

const QUERY_BLOCK_MARKER_PATTERN = QUERY_BLOCK_MARKER.source
  .replace(/\\/g, "\\\\")
  .replace(/"/g, '\\"');

export const listActiveQueries = () =>
  (
    window.roamAlphaAPI.data.fast.q(
      `[:find (pull ?b [:block/uid]) :where [or-join [?b] 
               [and [?b :block/string ?s] [[re-pattern "${QUERY_BLOCK_MARKER_PATTERN}"] ?query-block-regex] [[re-find ?query-block-regex ?s]]]
               ${getQueryPages()
                 .map(
                   (p) =>
                     `[and [?b :node/title ?t] [[re-pattern "^${p.replace(
                       /\*/,
                       ".*",
                     )}$"] ?regex] [[re-find ?regex ?t]]]`,
                 )
                 .join("\n")}
          ]]`,
    ) as [PullBlock][]
  ).map((b) => ({ uid: b[0][":block/uid"] || "" }));
