import getPageTitlesStartingWithPrefix from "roamjs-components/queries/getPageTitlesStartingWithPrefix";
import { DatalogAndClause, DatalogClause } from "roamjs-components/types";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getSubTree from "roamjs-components/util/getSubTree";
import discourseNodeFormatToDatalog from "./discourseNodeFormatToDatalog";
import conditionToDatalog, {
  getTitleDatalog,
  registerDatalogTranslator,
} from "./conditionToDatalog";
import { ANY_RELATION_REGEX } from "./deriveDiscourseNodeAttribute";
import getDiscourseNodes, {
  excludeDefaultNodes,
  type DiscourseNode,
} from "./getDiscourseNodes";
import getDiscourseRelations from "./getDiscourseRelations";
import matchDiscourseNode from "./matchDiscourseNode";
import replaceDatalogVariables from "./replaceDatalogVariables";
import parseQuery from "./parseQuery";
import { fireQuerySync, getWhereClauses } from "./fireQuery";
import { toVar } from "./compileDatalog";

const hasTag = (node: DiscourseNode): node is DiscourseNode & { tag: string } =>
  !!node.tag;

const collectVariables = (
  clauses: (DatalogClause | DatalogAndClause)[],
): Set<string> =>
  new Set(
    clauses.flatMap((c) => {
      switch (c.type) {
        case "data-pattern":
        case "fn-expr":
        case "pred-expr":
        case "rule-expr":
          return [...c.arguments]
            .filter((a) => a.type === "variable")
            .map((a) => a.value);
        case "not-join-clause":
        case "or-join-clause":
        case "not-clause":
        case "or-clause":
        case "and-clause":
          return Array.from(collectVariables(c.clauses));
        default:
          return [];
      }
    }),
  );

const ANY_DISCOURSE_NODE = "Any Discourse Node";

const registerDiscourseDatalogTranslators = () => {
  const discourseRelations = getDiscourseRelations();
  const discourseNodes = getDiscourseNodes(discourseRelations);

  const isACallback: Parameters<
    typeof registerDatalogTranslator
  >[0]["callback"] = ({ source, target }) => {
    const nodeByTypeOrText = Object.fromEntries([
      ...discourseNodes.map((n) => [n.type, n] as const),
      ...discourseNodes.map((n) => [n.text, n] as const),
    ]);
    return target === ANY_DISCOURSE_NODE
      ? [
          {
            type: "data-pattern" as const,
            arguments: [
              { type: "variable" as const, value: source },
              { type: "constant" as const, value: ":block/uid" },
              { type: "variable" as const, value: `${source}-uid` },
            ],
          },
          {
            type: "data-pattern" as const,
            arguments: [
              { type: "variable" as const, value: `${source}-any` },
              { type: "constant" as const, value: ":block/uid" },
              { type: "variable" as const, value: `${source}-uid` },
            ],
          },
          {
            type: "or-join-clause" as const,
            variables: [{ type: "variable" as const, value: `${source}-any` }],
            clauses: discourseNodes.filter(excludeDefaultNodes).map((dn) => ({
              type: "and-clause" as const,
              clauses: discourseNodeFormatToDatalog({
                freeVar: `${source}-any`,
                ...dn,
              }),
            })),
          },
        ]
      : nodeByTypeOrText[target]
        ? discourseNodeFormatToDatalog({
            freeVar: source,
            ...nodeByTypeOrText[target],
          })
        : [];
  };
  const isACandidateCallback: Parameters<
    typeof registerDatalogTranslator
  >[0]["callback"] = ({ source, target }) => {
    const nodeByTypeOrText = Object.fromEntries([
      ...discourseNodes.map((n) => [n.type, n] as const),
      ...discourseNodes.map((n) => [n.text, n] as const),
    ]);

    if (target === ANY_DISCOURSE_NODE) {
      const nodesWithTags = discourseNodes.filter(hasTag);
      if (nodesWithTags.length === 0) return [];
      return [
        {
          type: "or-join-clause" as const,
          variables: [{ type: "variable" as const, value: source }],
          clauses: nodesWithTags.map((node) => {
            const variableRef = `${toVar(node.tag)}-ref`;
            return {
              type: "and-clause" as const,
              clauses: [
                {
                  type: "data-pattern" as const,
                  arguments: [
                    { type: "variable" as const, value: source },
                    { type: "constant" as const, value: ":block/refs" },
                    {
                      type: "variable" as const,
                      value: variableRef,
                    },
                  ],
                },
                ...getTitleDatalog({ source: variableRef, target: node.tag }),
              ],
            };
          }),
        },
      ];
    }

    const targetNodeTag = nodeByTypeOrText[target].tag;
    if (!targetNodeTag) return [];
    const variableRef = `${toVar(targetNodeTag)}-ref`;

    return [
      {
        type: "data-pattern" as const,
        arguments: [
          { type: "variable" as const, value: source },
          { type: "constant" as const, value: ":block/refs" },
          {
            type: "variable" as const,
            value: variableRef,
          },
        ],
      },
      ...getTitleDatalog({ source: variableRef, target: targetNodeTag }),
    ];
  };
  const unregisters = new Set<() => void>();
  unregisters.add(
    registerDatalogTranslator({
      key: "is a",
      callback: isACallback,
      targetOptions: discourseNodes
        .map((d) => d.text)
        .concat(ANY_DISCOURSE_NODE),
      placeholder: "Enter a discourse node",
    }),
  );

  unregisters.add(
    registerDatalogTranslator({
      key: "is a candidate",
      callback: isACandidateCallback,
      targetOptions: discourseNodes
        .filter((d) => d.tag)
        .map((d) => d.text)
        .concat(ANY_DISCOURSE_NODE),
      placeholder: "Enter a discourse node",
    }),
  );
  unregisters.add(
    registerDatalogTranslator({
      key: "self",
      callback: ({ source, uid }) =>
        isACallback({ source, target: source, uid }),
    }),
  );
  unregisters.add(
    registerDatalogTranslator({
      key: "is involved with query",
      targetOptions: () =>
        getPageTitlesStartingWithPrefix("discourse-graph/queries/").map((q) =>
          q.substring("discourse-graph/queries/".length),
        ),
      callback: ({ source, target }) => {
        const queryUid = getPageUidByPageTitle(
          `discourse-graph/queries/${target}`,
        );
        const queryMetadataTree = getBasicTreeByParentUid(queryUid);
        const queryData = getSubTree({
          tree: queryMetadataTree,
          key: "query",
        });
        const { conditions, returnNode } = parseQuery(queryData);
        const clauses = getWhereClauses({ conditions, returnNode });
        const variables = Array.from(collectVariables(clauses));
        const orClause: DatalogClause = {
          type: "or-join-clause",
          variables: [{ type: "variable" as const, value: source }].concat(
            variables.map((value) => ({ value, type: "variable" })),
          ),
          clauses: variables.map((v) => ({
            type: "and-clause",
            clauses: [
              {
                type: "data-pattern",
                arguments: [
                  { type: "variable", value: v },
                  { type: "constant", value: ":block/uid" },
                  { type: "variable", value: `${v}-Uid` },
                ],
              },
              {
                type: "data-pattern",
                arguments: [
                  { type: "variable", value: source },
                  { type: "constant", value: ":block/uid" },
                  { type: "variable", value: `${v}-Uid` },
                ],
              },
            ],
          })),
        };
        return clauses.concat(orClause);
      },
      placeholder: "Enter query label",
    }),
  );

  const nodeLabelByType = Object.fromEntries(
    discourseNodes.map((n) => [n.type, n.text]),
  );
  const nodeByType = Object.fromEntries(discourseNodes.map((n) => [n.type, n]));
  const nodeTypeByLabel = Object.fromEntries(
    discourseNodes.map((n) => [n.text?.toLowerCase(), n.type]),
  );
  type matchRelation = {
    source: string;
    destination: string;
  };
  type matchCondition = {
    source: string;
    target: string;
  };
  const doesDiscourseRelationMatchCondition = (
    relation: matchRelation,
    condition: matchCondition,
  ) => {
    const sourceType = nodeLabelByType[relation.source];
    const targetType = nodeLabelByType[relation.destination];
    const sourceMatches =
      sourceType === condition.source || relation.source === "*";
    const targetNode = nodeByType[relation.destination];
    const targetMatches =
      targetType === condition.target ||
      relation.destination === "*" ||
      matchDiscourseNode({
        ...targetNode,
        title: condition.target,
      }) ||
      matchDiscourseNode({
        ...targetNode,
        uid: condition.target,
      });
    if (sourceMatches) {
      return (
        targetMatches ||
        (!nodeTypeByLabel[condition.target.toLowerCase()] &&
          !Object.values(nodeByType).some(
            (node) =>
              matchDiscourseNode({
                ...node,
                title: condition.target,
              }) ||
              matchDiscourseNode({
                ...node,
                uid: condition.target,
              }),
          ))
      );
    }
    if (targetMatches) {
      return (
        sourceMatches || !nodeTypeByLabel[condition?.source?.toLowerCase()]
      );
    }
    // if both are placeholders, sourceType and targetType will both be null, meaning we could match any condition
    return false; // !nodeLabelByType[condition.source] && !nodeLabelByType[condition.target]
  };

  const getFilteredRelations = ({
    discourseRelations,
    label,
    source,
    target,
  }: {
    discourseRelations: ReturnType<typeof getDiscourseRelations>;
    label: string;
    source: string;
    target: string;
  }) => {
    const matchCache = new Map<string, boolean>();

    const getCacheKey = (rel: matchRelation, cond: matchCondition) =>
      `${rel.source}:${rel.destination}:${cond.source}:${cond.target}`;

    const cachedMatchCondition = (rel: matchRelation, cond: matchCondition) => {
      const cacheKey = getCacheKey(rel, cond);
      if (!matchCache.has(cacheKey)) {
        matchCache.set(
          cacheKey,
          doesDiscourseRelationMatchCondition(rel, cond),
        );
      }
      return matchCache.get(cacheKey)!;
    };

    return discourseRelations
      .map((r) => {
        const forwardMatch =
          (r.label === label || ANY_RELATION_REGEX.test(label)) &&
          cachedMatchCondition(r, { source, target });

        if (forwardMatch) return { ...r, forward: true };

        const reverseMatch =
          cachedMatchCondition(
            { source: r.destination, destination: r.source },
            { source, target },
          ) &&
          (r.complement === label || ANY_RELATION_REGEX.test(label));

        if (reverseMatch) return { ...r, forward: false };

        return undefined;
      })
      .filter(
        (
          r,
        ): r is ReturnType<typeof getDiscourseRelations>[number] & {
          forward: boolean;
        } => !!r,
      );
  };

  const relationLabels = new Set(
    discourseRelations.flatMap((d) => [d.label, d.complement].filter(Boolean)),
  );
  relationLabels.add(ANY_RELATION_REGEX.source);
  relationLabels.forEach((label) => {
    unregisters.add(
      registerDatalogTranslator({
        key: label,
        callback: ({ source, target, uid }) => {
          const filteredRelations = getFilteredRelations({
            discourseRelations,
            label,
            source,
            target,
          });
          if (!filteredRelations.length) return [];
          const andParts = filteredRelations.map(
            ({
              triples,
              forward,
              source: relationSource,
              destination: relationTarget,
            }) => {
              const sourceTriple = triples.find((t) => t[2] === "source");
              const targetTriple = triples.find(
                (t) => t[2] === "destination" || t[2] === "target",
              );
              if (!sourceTriple || !targetTriple) return [];
              const computeEdgeTriple = ({
                nodeType,
                value,
                triple,
              }: {
                nodeType: string;
                value: string;
                triple: readonly [string, string, string];
              }): DatalogClause[] => {
                const possibleNodeType = nodeTypeByLabel[value?.toLowerCase()];
                if (possibleNodeType) {
                  return conditionToDatalog({
                    uid,
                    not: false,
                    target: possibleNodeType,
                    relation: "is a",
                    source: triple[0],
                    type: "clause",
                  });
                } else if (
                  !!window.roamAlphaAPI.pull("[:db/id]", [":block/uid", value])
                ) {
                  return [
                    {
                      type: "data-pattern",
                      arguments: [
                        { type: "variable", value: triple[0] },
                        { type: "constant", value: ":block/uid" },
                        { type: "constant", value: `"${value}"` },
                      ],
                    },
                  ];
                } else if (
                  value?.toLowerCase() !== "node" &&
                  !!window.roamAlphaAPI.pull("[:db/id]", [":node/title", value])
                ) {
                  return conditionToDatalog({
                    uid,
                    not: false,
                    target: value,
                    relation: "has title",
                    source: triple[0],
                    type: "clause",
                  });
                } else {
                  return conditionToDatalog({
                    uid,
                    not: false,
                    target: nodeType,
                    relation: "is a",
                    source: triple[0],
                    type: "clause",
                  });
                }
              };
              const edgeTriples = forward
                ? computeEdgeTriple({
                    value: source,
                    triple: sourceTriple,
                    nodeType: relationSource,
                  })
                    .concat(
                      computeEdgeTriple({
                        value: target,
                        triple: targetTriple,
                        nodeType: relationTarget,
                      }),
                    )
                    .concat([
                      {
                        type: "data-pattern",
                        arguments: [
                          { type: "variable", value: sourceTriple[0] },
                          { type: "constant", value: ":block/uid" },
                          { type: "variable", value: `${source}-uid` },
                        ],
                      },
                      {
                        type: "data-pattern",
                        arguments: [
                          { type: "variable", value: source },
                          { type: "constant", value: ":block/uid" },
                          { type: "variable", value: `${source}-uid` },
                        ],
                      },
                      {
                        type: "data-pattern",
                        arguments: [
                          { type: "variable", value: targetTriple[0] },
                          { type: "constant", value: ":block/uid" },
                          { type: "variable", value: `${target}-uid` },
                        ],
                      },
                      {
                        type: "data-pattern",
                        arguments: [
                          { type: "variable", value: target },
                          { type: "constant", value: ":block/uid" },
                          { type: "variable", value: `${target}-uid` },
                        ],
                      },
                    ])
                : computeEdgeTriple({
                    value: target,
                    triple: sourceTriple,
                    nodeType: relationSource,
                  })
                    .concat(
                      computeEdgeTriple({
                        value: source,
                        triple: targetTriple,
                        nodeType: relationTarget,
                      }),
                    )
                    .concat([
                      {
                        type: "data-pattern",
                        arguments: [
                          { type: "variable", value: targetTriple[0] },
                          { type: "constant", value: ":block/uid" },
                          { type: "variable", value: `${source}-uid` },
                        ],
                      },
                      {
                        type: "data-pattern",
                        arguments: [
                          { type: "variable", value: source },
                          { type: "constant", value: ":block/uid" },
                          { type: "variable", value: `${source}-uid` },
                        ],
                      },
                      {
                        type: "data-pattern",
                        arguments: [
                          { type: "variable", value: sourceTriple[0] },
                          { type: "constant", value: ":block/uid" },
                          { type: "variable", value: `${target}-uid` },
                        ],
                      },
                      {
                        type: "data-pattern",
                        arguments: [
                          { type: "variable", value: target },
                          { type: "constant", value: ":block/uid" },
                          { type: "variable", value: `${target}-uid` },
                        ],
                      },
                    ]);
              const subQuery = triples
                .filter((t) => t !== sourceTriple && t !== targetTriple)
                .flatMap(([src, rel, tar]) =>
                  conditionToDatalog({
                    source: src,
                    relation: rel,
                    target: tar,
                    not: false,
                    uid,
                    type: "clause",
                  }),
                );
              return replaceDatalogVariables(
                [
                  { from: source, to: source },
                  { from: target, to: target },
                  { from: true, to: (v) => `${uid}-${v}` },
                ],
                edgeTriples.concat(subQuery),
              );
            },
          );
          if (andParts.length === 1) return andParts[0];

          const orJoinedVars = collectVariables(andParts[0]);
          andParts.slice(1).forEach((a) => {
            const freeVars = collectVariables(a);
            Array.from(orJoinedVars).forEach((v) => {
              if (!freeVars.has(v)) orJoinedVars.delete(v);
            });
          });
          return [
            {
              type: "or-join-clause",
              variables: Array.from(orJoinedVars).map((v) => ({
                type: "variable",
                value: v,
              })),
              clauses: andParts.map((a) => ({
                type: "and-clause",
                clauses: a,
              })),
            },
          ];
        },
        targetOptions: () => {
          const allRelations = discourseRelations.flatMap((dr) => [
            {
              source: dr.source,
              relation: dr.label,
              target: dr.destination,
            },
            {
              source: dr.destination,
              relation: dr.complement,
              target: dr.source,
            },
          ]);
          const relevantRelations = ANY_RELATION_REGEX.test(label)
            ? allRelations
            : allRelations.filter(
                (dr) => dr.relation === label && nodeByType[dr.target],
              );
          const relevantTargets = Array.from(
            new Set(relevantRelations.map((rr) => rr.target)),
          );
          if (relevantTargets.length === 0) return [];
          try {
            return fireQuerySync({
              returnNode: "node",
              conditions: [
                {
                  type: "or",
                  conditions: relevantTargets.map((target) => [
                    {
                      source: "node",
                      relation: "is a",
                      target,
                      uid: window.roamAlphaAPI.util.generateUID(),
                      type: "clause",
                    },
                  ]),
                  uid: window.roamAlphaAPI.util.generateUID(),
                },
              ],
              selections: [],
            })
              .map((n) => n.text)
              .concat(relevantTargets.map((rt) => nodeByType[rt].text));
          } catch (e) {
            debugger;
            return [];
          }
        },
        placeholder: "Enter a valid target",
      }),
    );
  });
  return Array.from(unregisters);
};

export default registerDiscourseDatalogTranslators;
