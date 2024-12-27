import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getDiscourseRelationLabels from "./getDiscourseRelationLabels";
import discourseConfigRef from "./discourseConfigRef";
import registerDiscourseDatalogTranslators from "./registerDiscourseDatalogTranslators";
import { unregisterDatalogTranslator } from "./conditionToDatalog";
import type { PullBlock } from "roamjs-components/types/native";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/settings/configPages";

const getPagesStartingWithPrefix = (prefix: string) =>
  (
    window.roamAlphaAPI.data.fast.q(
      `[:find (pull ?b [:block/uid :node/title]) :where [?b :node/title ?title] [(clojure.string/starts-with? ?title  "${prefix}")]]`,
    ) as [PullBlock][]
  ).map((r) => ({
    title: r[0][":node/title"] || "",
    uid: r[0][":block/uid"] || "",
  }));

const refreshConfigTree = () => {
  getDiscourseRelationLabels().forEach((key) =>
    unregisterDatalogTranslator({ key }),
  );
  discourseConfigRef.tree = getBasicTreeByParentUid(
    getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE),
  );
  const pages = getPagesStartingWithPrefix("discourse-graph/nodes");
  discourseConfigRef.nodes = Object.fromEntries(
    pages.map(({ title, uid }) => {
      return [
        uid,
        {
          text: title.substring("discourse-graph/nodes/".length),
          children: getBasicTreeByParentUid(uid),
        },
      ];
    }),
  );
  registerDiscourseDatalogTranslators();
};

export default refreshConfigTree;
