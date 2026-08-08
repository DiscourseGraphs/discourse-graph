import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getDiscourseRelationLabels from "./getDiscourseRelationLabels";
import discourseConfigRef from "./discourseConfigRef";
import registerDiscourseDatalogTranslators from "./registerDiscourseDatalogTranslators";
import { unregisterDatalogTranslator } from "./conditionToDatalog";
import type { PullBlock, RoamBasicNode } from "roamjs-components/types/native";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/data/constants";
import type { SettingsSnapshot } from "~/components/settings/utils/accessors";

// Null-safe replacement for roamjs-components' getBasicTreeByParentUid.
//
// Some graphs carry a `:block/children` edge from a page to a "phantom" block
// whose pull returns null (no :block/uid / :block/order / :block/string). The
// upstream helper sorts the raw pull rows by `:block/order` without filtering,
// so a single dangling child throws `Cannot read properties of null` — and,
// because refreshConfigTree runs first in onload, that aborts the entire
// extension load (no commands, menus, or UI register). Dropping the nulls
// preserves every real config block and lets the plugin load.
const sortBasicNodesSafe = (nodes: (PullBlock | null)[]): RoamBasicNode[] =>
  nodes
    .filter((n): n is PullBlock => n !== null)
    .sort(
      (a, b) =>
        ((a[":block/order"] as number) || 0) -
        ((b[":block/order"] as number) || 0),
    )
    .map((node) => ({
      children: sortBasicNodesSafe(
        (node[":block/children"] as (PullBlock | null)[]) || [],
      ),
      uid: node[":block/uid"] || "",
      text: node[":block/string"] || "",
    }));

const getBasicTreeByParentUidSafe = (uid: string): RoamBasicNode[] =>
  sortBasicNodesSafe(
    (
      window.roamAlphaAPI.data.fast.q(
        `[:find (pull ?c [:block/string :block/uid :block/order {:block/children ...}]) :where [?b :block/uid "${uid}"] [?b :block/children ?c]]`,
      ) as [PullBlock | null][]
    ).map((a) => a[0]),
  );

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
  getDiscourseRelationLabels(undefined, snapshot).forEach((key) =>
    unregisterDatalogTranslator({ key }),
  );
  discourseConfigRef.tree = getBasicTreeByParentUidSafe(
    getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE),
  );
  const pages = getPagesStartingWithPrefix("discourse-graph/nodes");
  discourseConfigRef.nodes = Object.fromEntries(
    pages.map(({ title, uid }) => {
      return [
        uid,
        {
          text: title.substring("discourse-graph/nodes/".length),
          children: getBasicTreeByParentUidSafe(uid),
        },
      ];
    }),
  );
  registerDiscourseDatalogTranslators(snapshot);
};

export default refreshConfigTree;
