import type {
  InputTextNode,
  RoamBasicNode,
  TextNode,
} from "roamjs-components/types/native";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import DEFAULT_RELATION_VALUES from "~/data/defaultDiscourseRelations";
import {
  isNewSettingsStoreEnabled,
  getAllRelations,
  type SettingsSnapshot,
} from "~/components/settings/utils/accessors";
import discourseConfigRef from "./discourseConfigRef";
import {
  measurePerformanceStep,
  resolvePerformanceTraceContext,
  withPerformanceTrace,
  type PerformanceTraceArg,
} from "./performanceLogger";

export type Triple = readonly [string, string, string];
export type DiscourseRelation = {
  triples: Triple[];
  id: string;
  label: string;
  source: string;
  destination: string;
  complement: string;
};

const matchNodeText = (keyword: string) => {
  return (node: RoamBasicNode | TextNode) =>
    toFlexRegex(keyword).test(node.text);
};

export const getGrammarNode = () => {
  return discourseConfigRef.tree.find(matchNodeText("grammar"));
};

export const getRelationsNode = (grammarNode = getGrammarNode()) => {
  return grammarNode?.children.find(matchNodeText("relations"));
};

let getDiscourseRelationsCallCount = 0;

const getDiscourseRelations = (
  snapshot?: SettingsSnapshot,
  trace?: PerformanceTraceArg,
): DiscourseRelation[] => {
  const context = resolvePerformanceTraceContext({
    trace,
    ignoredPatterns: ["getDiscourseRelations"],
  });
  const traceId =
    context.traceId ??
    `getDiscourseRelations#${++getDiscourseRelationsCallCount}`;
  const source = context.source;
  const content = context.content;
  let newStoreEnabled = false;
  let relationCount = 0;
  let relationConfigCount = 0;
  let resolveStoreFlagMs = 0;
  let getAllRelationsMs = 0;
  let getGrammarNodeMs = 0;
  let getRelationsNodeMs = 0;
  let resolveLegacyRelationNodesMs = 0;
  let flattenLegacyRelationsMs = 0;

  return withPerformanceTrace(
    {
      label: "getDiscourseRelations",
      thresholdMs: 0,
      aggregateThresholdMs: 50,
      details: () => ({
        traceId,
        source,
        content,
        hasSnapshot: !!snapshot,
        newStoreEnabled,
        relationConfigCount,
        relationCount,
        resolveStoreFlagMs,
        getAllRelationsMs,
        getGrammarNodeMs,
        getRelationsNodeMs,
        resolveLegacyRelationNodesMs,
        flattenLegacyRelationsMs,
      }),
    },
    () => {
      const [resolvedNewStoreEnabled, measuredResolveStoreFlagMs] =
        measurePerformanceStep(() =>
          snapshot
            ? snapshot.featureFlags["Use new settings store"]
            : isNewSettingsStoreEnabled({ traceId, source, content }),
        );
      newStoreEnabled = resolvedNewStoreEnabled;
      resolveStoreFlagMs = measuredResolveStoreFlagMs;

      if (newStoreEnabled) {
        const [relations, measuredGetAllRelationsMs] = measurePerformanceStep(
          () => getAllRelations(snapshot, { traceId, source, content }),
        );
        getAllRelationsMs = measuredGetAllRelationsMs;
        relationCount = relations.length;
        return relations;
      }

      const [grammarNode, measuredGetGrammarNodeMs] =
        measurePerformanceStep(getGrammarNode);
      getGrammarNodeMs = measuredGetGrammarNodeMs;

      const [relationsNode, measuredGetRelationsNodeMs] =
        measurePerformanceStep(() => getRelationsNode(grammarNode));
      getRelationsNodeMs = measuredGetRelationsNodeMs;

      const [relationNodes, measuredResolveLegacyRelationNodesMs] =
        measurePerformanceStep(
          () => relationsNode?.children || DEFAULT_RELATION_VALUES,
        );
      resolveLegacyRelationNodesMs = measuredResolveLegacyRelationNodesMs;
      relationConfigCount = relationNodes.length;

      const [discourseRelations, measuredFlattenLegacyRelationsMs] =
        measurePerformanceStep(() =>
          relationNodes.flatMap((r: InputTextNode, i: number) => {
            const tree = (r?.children || []) as TextNode[];
            const data = {
              id: r.uid || `${r.text}-${i}`,
              label: r.text,
              source: getSettingValueFromTree({ tree, key: "Source" }),
              destination: getSettingValueFromTree({
                tree,
                key: "Destination",
              }),
              complement: getSettingValueFromTree({ tree, key: "Complement" }),
            };
            const ifNode = tree.find(matchNodeText("if"))?.children || [];
            return ifNode.map((node) => ({
              ...data,
              triples: node.children
                .filter((t) => !/node positions/i.test(t.text))
                .map((t) => {
                  const target = t.children[0]?.children?.[0]?.text || "";
                  return [t.text, t.children[0]?.text, target] as const;
                }),
            }));
          }),
        );
      flattenLegacyRelationsMs = measuredFlattenLegacyRelationsMs;
      relationCount = discourseRelations.length;
      return discourseRelations;
    },
  );
};

export default getDiscourseRelations;
