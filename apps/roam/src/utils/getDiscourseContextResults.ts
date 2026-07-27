// TODO POST MIGRATE - Merge into a single query
import { Result } from "roamjs-components/types/query-builder";
import findDiscourseNode from "./findDiscourseNode";
import fireQuery from "./fireQuery";
import getDiscourseNodes from "./getDiscourseNodes";
import getDiscourseRelations, {
  DiscourseRelation,
} from "./getDiscourseRelations";
import { Selection } from "./types";
import { getSetting } from "./extensionSettings";
import {
  ANY_RELATION_NAME,
  ANY_RELATION_REGEX,
} from "./deriveDiscourseNodeAttribute";

const resultCache: Record<string, Awaited<ReturnType<typeof fireQuery>>> = {};
const CACHE_TIMEOUT = 1000 * 60 * 5;
const ANY_RELATION_ID = "any_relation";

type BuildQueryConfig = {
  args: {
    ignoreCache?: boolean;
  };
  targetUid: string;
  fireQueryContext: {
    nodes: ReturnType<typeof getDiscourseNodes>;
    relations: ReturnType<typeof getDiscourseRelations>;
  };
  nodeTextByType: Record<string, string>;
  r: DiscourseRelation;
  complement: boolean;
};
type QueryConfig = {
  relation: {
    id: string;
    text: string;
    target: string;
    isComplement: boolean;
  };
  queryPromise: () => Promise<Result[]>;
};

type SelectionConfig = {
  r: DiscourseRelation;
  conditionUid?: string;
};
const buildSelections = ({
  r,
  conditionUid = window.roamAlphaAPI.util.generateUID(),
}: SelectionConfig): Selection[] => {
  const selections: Selection[] = [];

  if (r.triples.some((t) => t.some((a) => /context/i.test(a)))) {
    selections.push({
      uid: window.roamAlphaAPI.util.generateUID(),
      label: "context",
      text: `node:${conditionUid}-Context`,
    });
  }
  return selections;
};

type onResult = (result: {
  label: string;
  results: Record<
    string,
    Partial<Result & { target: string; complement: number; id: string }>
  >;
}) => void;

const executeQueries = async (
  queryConfigs: QueryConfig[],
  targetUid: string,
  nodeTextByType: Record<string, string>,
  onResult?: onResult,
) => {
  const promises = queryConfigs.map(async ({ relation, queryPromise }) => {
    let results = await queryPromise();
    results = results.map((r) => ({ ...r, ctxTargetUid: targetUid }));
    if (onResult) {
      const groupedResult = {
        label: relation.text,
        results: Object.fromEntries(
          results
            .filter((a) => a.uid !== targetUid)
            .map((res) => [
              res.uid,
              {
                ...res,
                target: nodeTextByType[relation.target],
                complement: relation.isComplement ? 1 : 0,
                id: relation.id,
              },
            ]),
        ),
      };
      onResult(groupedResult);
    }
    return { relation, results };
  });

  const results = await Promise.all(promises);
  return results;
};

const buildQueryConfig = ({
  args,
  targetUid,
  fireQueryContext,
  nodeTextByType,
  r,
  complement: isComplement,
}: BuildQueryConfig): QueryConfig => {
  const { ignoreCache } = args;
  const target = isComplement ? r.source : r.destination;
  const text = isComplement ? r.complement : r.label;
  const cacheKey = `${targetUid}~${text}~${target}`;

  const relation = {
    id: r.id,
    text,
    target,
    isComplement,
  };

  if (ignoreCache) delete resultCache[cacheKey];

  if (resultCache[cacheKey]) {
    return {
      relation,
      queryPromise: () => Promise.resolve(resultCache[cacheKey]),
    };
  }

  const returnNode = nodeTextByType[target];

  const conditionUid = window.roamAlphaAPI.util.generateUID();
  const isAllRelationsQuery = ANY_RELATION_REGEX.test(r.label);
  const selections = buildSelections({ r, conditionUid });
  const findVariables = isAllRelationsQuery
    ? [
        {
          label: "relationUid",
          variable: `${conditionUid}-relSchema`,
        },
        {
          label: "effectiveSource",
          variable: `${conditionUid}-relSource`,
        },
      ]
    : [];
  const { nodes, relations } = fireQueryContext;
  return {
    relation,
    queryPromise: () =>
      fireQuery({
        returnNode,
        conditions: [
          {
            source: returnNode,
            // NOTE! This MUST be the OPPOSITE of `label`
            relation: isComplement ? r.label : r.complement,
            target: targetUid,
            uid: conditionUid,
            type: "clause",
          },
        ],
        selections,
        findVariables,
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
      }),
  };
};

const getDiscourseContextResults = async ({
  uid: targetUid,
  relations = getDiscourseRelations(),
  nodes = getDiscourseNodes(),
  ignoreCache,
  onResult,
}: {
  uid: string;
  nodes?: ReturnType<typeof getDiscourseNodes>;
  relations?: ReturnType<typeof getDiscourseRelations>;
  ignoreCache?: boolean;
  onResult?: onResult;
}) => {
  const args = { ignoreCache };

  const discourseNode = findDiscourseNode({ uid: targetUid });
  if (!discourseNode) return [];
  const useReifiedRelations = getSetting<boolean>(
    "use-reified-relations",
    false,
  );
  const nodeType = discourseNode?.type;
  const nodeTextByType = Object.fromEntries(
    nodes.map(({ type, text }) => [type, text]),
  );
  nodeTextByType["*"] = "Any";

  type RelationWithComplement = {
    id: string;
    r: DiscourseRelation;
    complement: boolean;
  };
  const uniqueRelations = new Map<string, RelationWithComplement>();

  relations.forEach((r) => {
    if (r.source === nodeType || r.source === "*") {
      uniqueRelations.set(`${r.id}-false`, {
        id: r.id,
        r,
        complement: false,
      });
    }
    if (r.destination === nodeType || r.destination === "*") {
      uniqueRelations.set(`${r.id}-true`, {
        id: r.id,
        r,
        complement: true,
      });
    }
  });

  const relationsWithComplement = Array.from(uniqueRelations.values());
  const queryRelations = useReifiedRelations
    ? [
        {
          id: ANY_RELATION_ID,
          r: {
            id: ANY_RELATION_ID,
            complement: ANY_RELATION_NAME,
            label: ANY_RELATION_NAME,
            triples: [],
            source: "*",
            destination: "*",
          },
          complement: false,
        },
      ]
    : relationsWithComplement;

  const context = { nodes, relations };
  const queryConfigs = queryRelations.map((relation) =>
    buildQueryConfig({
      args,
      targetUid,
      nodeTextByType,
      fireQueryContext: {
        ...context,
      },
      r: relation.r,
      complement: relation.complement,
    }),
  );
  const postQueryOnResult = useReifiedRelations ? onResult : undefined;
  onResult = postQueryOnResult ? undefined : onResult;

  let resultsWithRelation = await executeQueries(
    queryConfigs,
    targetUid,
    nodeTextByType,
    onResult,
  );
  if (
    useReifiedRelations &&
    resultsWithRelation.length > 0 &&
    resultsWithRelation[0].results.length > 0
  ) {
    const byRel: Record<string, Result[]> = {};
    const results = resultsWithRelation[0].results;
    resultsWithRelation = [];
    for (const r of results) {
      const relKey = `${r.relationUid as string}-${r.effectiveSource !== targetUid}`;
      byRel[relKey] = byRel[relKey] || [];
      byRel[relKey].push(r);
    }
    resultsWithRelation = Array.from(uniqueRelations.entries()).flatMap(
      ([ruid, relation]) => {
        const results = byRel[ruid];
        if (!results?.length) return [];
        delete byRel[ruid];
        const isComplement = relation.complement;
        return [
          {
            relation: {
              id: relation.id,
              label: isComplement ? relation.r.complement : relation.r.label,
              isComplement,
              text: isComplement ? relation.r.complement : relation.r.label,
              target: isComplement ? relation.r.source : relation.r.destination,
            },
            results,
          },
        ];
      },
    );
    Object.keys(byRel).forEach((ruid) => {
      /*
       * A stored reified relation can outlive its relation schema, or the
       * schema can stop applying to this node type after source/destination
       * settings change. Drop that stale result from discourse context
       * instead of treating it as a runtime failure.
       */
      console.warn("Relation with obsolete relation type:" + ruid);
    });
  }
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
      .filter((a) => a.uid !== targetUid)
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
  const asResultList = Object.entries(groupedResults)
    .filter(([, results]) => Object.keys(results).length > 0)
    .map(([label, results]) => ({
      label,
      results,
    }));
  if (postQueryOnResult) asResultList.map((r) => postQueryOnResult(r));
  return asResultList;
};

export default getDiscourseContextResults;
