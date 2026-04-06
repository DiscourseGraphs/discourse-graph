import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getDiscourseRelationLabels from "./getDiscourseRelationLabels";
import discourseConfigRef from "./discourseConfigRef";
import registerDiscourseDatalogTranslators from "./registerDiscourseDatalogTranslators";
import { unregisterDatalogTranslator } from "./conditionToDatalog";
import type { PullBlock } from "roamjs-components/types/native";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/data/constants";
import type { SettingsSnapshot } from "~/components/settings/utils/accessors";

const getPagesStartingWithPrefix = (prefix: string) =>
  (
    window.roamAlphaAPI.data.fast.q(
      `[:find (pull ?b [:block/uid :node/title]) :where [?b :node/title ?title] [(clojure.string/starts-with? ?title  "${prefix}")]]`,
    ) as [PullBlock][]
  ).map((r) => ({
    title: r[0][":node/title"] || "",
    uid: r[0][":block/uid"] || "",
  }));

const refreshConfigTree = (snapshot?: SettingsSnapshot) => {
  let t = performance.now();
  const mark = (label: string) => {
    const now = performance.now();
    console.log(
      `[DG Plugin] refreshConfigTree.${label}: ${Math.round(now - t)}ms`,
    );
    t = now;
  };

  const labels = getDiscourseRelationLabels(undefined, snapshot);
  mark("getDiscourseRelationLabels");
  labels.forEach((key) => unregisterDatalogTranslator({ key }));
  mark("unregisterDatalogTranslator loop");

  discourseConfigRef.tree = getBasicTreeByParentUid(
    getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE),
  );
  mark("getBasicTreeByParentUid(DG config page)");

  const pages = getPagesStartingWithPrefix("discourse-graph/nodes");
  mark(`getPagesStartingWithPrefix (${pages.length} pages)`);

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
  mark(`getBasicTreeByParentUid per-page loop (${pages.length} pages)`);

  registerDiscourseDatalogTranslators(snapshot);
  mark("registerDiscourseDatalogTranslators");
};

export default refreshConfigTree;
