// TODO POST MIGRATE - Merge into a single query
import { Result } from "roamjs-components/types/query-builder";
import findDiscourseNode from "./findDiscourseNode";
import fireQuery from "./fireQuery";
import getDiscourseNodes from "./getDiscourseNodes";
import getDiscourseRelations, {
  DiscourseRelation,
} from "./getDiscourseRelations";
import { Selection } from "./types";

const resultCache: Record<string, Awaited<ReturnType<typeof fireQuery>>> = {};
const CACHE_TIMEOUT = 1000 * 60 * 5;

type BuildQueryConfig = {
  args: {
    ignoreCache?: true;
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
  } else if (r.triples.some((t) => t.some((a) => /anchor/i.test(a)))) {
    selections.push({
      uid: window.roamAlphaAPI.util.generateUID(),
      label: "anchor",
      text: `node:${conditionUid}-Anchor`,
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
    const results = await queryPromise();
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

  if (resultCache[cacheKey] && !ignoreCache) {
    return {
      relation,
      queryPromise: () => Promise.resolve(resultCache[cacheKey]),
    };
  }

  const returnNode = nodeTextByType[target];

  const conditionUid = window.roamAlphaAPI.util.generateUID();
  const selections = buildSelections({ r, conditionUid });
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
  nodes = getDiscourseNodes(relations),
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

  const discourseNode = findDiscourseNode(targetUid);
  if (!discourseNode) return [];
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

  const context = { nodes, relations };
  const queryConfigs = relationsWithComplement.map((relation) =>
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

  const resultsWithRelation = await executeQueries(
    queryConfigs,
    targetUid,
    nodeTextByType,
    onResult,
  );
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
  return Object.entries(groupedResults).map(([label, results]) => ({
    label,
    results,
  }));
};

export default getDiscourseContextResults;
