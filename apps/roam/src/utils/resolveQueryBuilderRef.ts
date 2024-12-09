import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import extractRef from "roamjs-components/util/extractRef";
import { getQueryPages } from "../components/settings/QueryPagesPanel";
import { OnloadArgs } from "roamjs-components/types";

const resolveQueryBuilderRef = ({
  queryRef,
  extensionAPI,
}: {
  queryRef: string;
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  const parentUid = isLiveBlock(extractRef(queryRef))
    ? extractRef(queryRef)
    : window.roamAlphaAPI.data.fast
        .q(
          `[:find ?uid :where [?b :block/uid ?uid] [or-join [?b] 
             [and [?b :block/string ?s] [[clojure.string/includes? ?s "{{query block:${queryRef}}}"]] ]
             ${getQueryPages(extensionAPI).map(
               (p) => `[and [?b :node/title "${p.replace(/\*/, queryRef)}"]]`,
             )}
              [and [?b :node/title "${queryRef}"]]
        ]]`,
        )[0]
        ?.toString() || "";
  return parentUid;
};

export default resolveQueryBuilderRef;
