import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import extractRef from "roamjs-components/util/extractRef";
import { getQueryPages } from "~/components/settings/utils/accessors";

const resolveQueryBuilderRef = ({ queryRef }: { queryRef: string }) => {
  const parentUid = isLiveBlock(extractRef(queryRef))
    ? extractRef(queryRef)
    : window.roamAlphaAPI.data.fast
        .q(
          `[:find ?uid :where [?b :block/uid ?uid] [or-join [?b]
             [and [?b :block/string ?s] [[clojure.string/includes? ?s "{{query block:${queryRef}}}"]] ]
             ${getQueryPages().map(
               (p) => `[and [?b :node/title "${p.replace(/\*/, queryRef)}"]]`,
             )}
              [and [?b :node/title "${queryRef}"]]
        ]]`,
        )[0]
        ?.toString() || "";
  return parentUid;
};

export default resolveQueryBuilderRef;
