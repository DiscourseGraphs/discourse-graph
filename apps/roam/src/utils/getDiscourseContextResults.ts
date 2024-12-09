// TODO POST MIGRATE - Merge into a single query
import { Result } from "roamjs-components/types/query-builder";
import findDiscourseNode from "./findDiscourseNode";
import fireQuery from "./fireQuery";
import getDiscourseNodes from "./getDiscourseNodes";
import getDiscourseRelations from "./getDiscourseRelations";

const resultCache: Record<string, Awaited<ReturnType<typeof fireQuery>>> = {};
const CACHE_TIMEOUT = 1000 * 60 * 5;

const getDiscourseContextResults = async ({
  uid,
  relations = getDiscourseRelations(),
  nodes = getDiscourseNodes(relations),
  ignoreCache,
}: {
  uid: string;
  nodes?: ReturnType<typeof getDiscourseNodes>;
  relations?: ReturnType<typeof getDiscourseRelations>;
  ignoreCache?: true;
}) => {
  const discourseNode = findDiscourseNode(uid);
  if (!discourseNode) return [];
  const nodeType = discourseNode?.type;
  const nodeTextByType = Object.fromEntries(
    nodes.map(({ type, text }) => [type, text]),
  );
  nodeTextByType["*"] = "Any";
  const resultsWithRelation = await Promise.all(
    relations
      .flatMap((r) => {
        const queries = [];
        if (r.source === nodeType || r.source === "*") {
          queries.push({
            r,
            complement: false,
          });
        }
        if (r.destination === nodeType || r.destination === "*") {
          queries.push({
            r,
            complement: true,
          });
        }
        return queries;
      })
      .map(async ({ r, complement: isComplement }) => {
        const target = isComplement ? r.source : r.destination;
        const text = isComplement ? r.complement : r.label;
        const returnNode = nodeTextByType[target];
        const cacheKey = `${uid}~${text}~${target}`;
        const conditionUid = window.roamAlphaAPI.util.generateUID();
        const selections = [];
        if (r.triples.some((t) => t.some((a) => /context/i.test(a)))) {
          selections.push({
            uid: window.roamAlphaAPI.util.generateUID(),
            label: "context",
            text: `node:${conditionUid}-Context`,
          });
        } else if (r.triples.some((t) => t.some((a) => /anchor/i.test(a)))) {
          selections.push({
            uid: window.roamAlphaAPI.util.generateUID(),
            label: "anchor",
            text: `node:${conditionUid}-Anchor`,
          });
        }
        const relation = {
          id: r.id,
          text,
          target,
          isComplement,
        };
        const rawResults =
          resultCache[cacheKey] && !ignoreCache
            ? Promise.resolve(resultCache[cacheKey])
            : fireQuery({
                returnNode,
                conditions: [
                  {
                    source: returnNode,
                    // NOTE! This MUST be the OPPOSITE of `label`
                    relation: isComplement ? r.label : r.complement,
                    target: uid,
                    uid: conditionUid,
                    type: "clause",
                  },
                ],
                selections,
                context: {
                  relationsInQuery: [relation],
                  customNodes: nodes,
                  customRelations: relations,
                },
              }).then((results) => {
                resultCache[cacheKey] = results;
                setTimeout(() => {
                  delete resultCache[cacheKey];
                }, CACHE_TIMEOUT);
                return results;
              });
        return rawResults.then((results) => ({
          relation: {
            text,
            isComplement,
            target,
            id: r.id,
          },
          results,
        }));
      }),
  ).catch((e) => {
    console.error(e);
    return [] as const;
  });
  const groupedResults = Object.fromEntries(
    resultsWithRelation.map((r) => [
      r.relation.text,
      {} as Record<
        string,
        Partial<Result & { target: string; complement: number; id: string }>
      >,
    ]),
  );
  resultsWithRelation.forEach((r) =>
    r.results
      .filter((a) => a.uid !== uid)
      .forEach(
        (res) =>
          // TODO POST MIGRATE - set result to its own field
          (groupedResults[r.relation.text][res.uid] = {
            ...res,
            target: nodeTextByType[r.relation.target],
            complement: r.relation.isComplement ? 1 : 0,
            id: r.relation.id,
          }),
      ),
  );
  return Object.entries(groupedResults).map(([label, results]) => ({
    label,
    results,
  }));
};

export default getDiscourseContextResults;
