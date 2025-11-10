import conditionToDatalog from "./conditionToDatalog";
import type {
  PullBlock,
  DatalogClause,
  DatalogAndClause,
} from "roamjs-components/types";
import compileDatalog from "./compileDatalog";
import { getNodeEnv } from "roamjs-components/util/env";
import type { Condition, Result as QueryResult, Selection } from "./types";
import gatherDatalogVariablesFromClause from "./gatherDatalogVariablesFromClause";
import predefinedSelections, {
  PredefinedSelection,
} from "./predefinedSelections";
import { DEFAULT_RETURN_NODE } from "./parseQuery";
import { DiscourseNode } from "./getDiscourseNodes";
import { DiscourseRelation } from "./getDiscourseRelations";
import nanoid from "nanoid";

export type QueryArgs = {
  returnNode?: string;
  conditions: Condition[];
  selections: Selection[];
  inputs?: Record<string, string | number>;
};
type RelationInQuery = {
  id: string;
  text: string;
  isComplement: boolean;
};
export type FireQueryArgs = QueryArgs & {
  isCustomEnabled?: boolean;
  customNode?: string;
  context?: {
    relationsInQuery?: RelationInQuery[];
    customNodes?: DiscourseNode[];
    customRelations?: DiscourseRelation[];
  };
};

type FireQuery = (query: FireQueryArgs) => Promise<QueryResult[]>;

const firstVariable = (
  clause: DatalogClause | DatalogAndClause,
): string | undefined => {
  if (
    clause.type === "data-pattern" ||
    clause.type === "fn-expr" ||
    clause.type === "pred-expr" ||
    clause.type === "rule-expr"
  ) {
    return [...clause.arguments].find((v) => v.type === "variable")?.value;
  } else if (
    clause.type === "not-clause" ||
    clause.type === "or-clause" ||
    clause.type === "and-clause"
  ) {
    return firstVariable(clause.clauses[0]);
  } else if (
    clause.type === "not-join-clause" ||
    clause.type === "or-join-clause"
  ) {
    return clause.variables[0]?.value;
  }
  return undefined;
};

const optimizeQuery = (
  clauses: (DatalogClause | DatalogAndClause)[],
  capturedVariables: Set<string>,
): (DatalogClause | DatalogAndClause)[] => {
  const marked = clauses.map(() => false);
  const orderedClauses: (DatalogClause | DatalogAndClause)[] = [];
  const variablesByIndex: Record<number, Set<string>> = {};
  for (let i = 0; i < clauses.length; i++) {
    let bestClauseIndex = clauses.length;
    let bestClauseScore = Number.MAX_VALUE;
    clauses.forEach((c, j) => {
      if (marked[j]) return;
      let score = bestClauseScore;
      if (c.type === "data-pattern") {
        if (
          c.arguments[0]?.type === "variable" &&
          c.arguments[1]?.type === "constant"
        ) {
          if (c.arguments[2]?.type === "constant") {
            score = 1;
          } else if (
            c.arguments[2]?.type === "variable" &&
            (capturedVariables.has(c.arguments[0].value) ||
              capturedVariables.has(c.arguments[2].value))
          ) {
            score = 2;
          } else {
            score = 100000;
          }
        } else {
          score = 100001;
        }
      } else if (
        c.type === "not-clause" ||
        c.type === "or-clause" ||
        c.type === "and-clause"
      ) {
        const allVars =
          variablesByIndex[j] ||
          (variablesByIndex[j] = gatherDatalogVariablesFromClause(c));
        if (Array.from(allVars).every((v) => capturedVariables.has(v))) {
          score = 10;
        } else {
          // downgrade disjunction and negation
          score = c.type === "and-clause" ? 100002 : 100006;
        }
      } else if (c.type === "not-join-clause" || c.type === "or-join-clause") {
        if (c.variables.every((v) => capturedVariables.has(v.value))) {
          score = 100;
        } else {
          score = 100003;
        }
      } else if (
        c.type === "fn-expr" ||
        c.type === "pred-expr" ||
        c.type === "rule-expr"
      ) {
        if (
          [...c.arguments].every(
            (a) => a.type !== "variable" || capturedVariables.has(a.value),
          )
        ) {
          score = 1000;
        } else {
          score = 100004;
        }
      } else {
        score = 100005;
      }
      if (score < bestClauseScore) {
        bestClauseScore = score;
        bestClauseIndex = j;
      }
    });
    marked[bestClauseIndex] = true;
    const bestClause = clauses[bestClauseIndex];
    orderedClauses.push(clauses[bestClauseIndex]);
    if (
      bestClause.type === "not-join-clause" ||
      bestClause.type === "or-join-clause" ||
      bestClause.type === "not-clause" ||
      bestClause.type === "or-clause" ||
      bestClause.type === "and-clause"
    ) {
      bestClause.clauses = optimizeQuery(
        bestClause.clauses,
        new Set(capturedVariables),
      );
    } else if (bestClause.type === "data-pattern") {
      bestClause.arguments
        .filter((v) => v.type === "variable")
        .forEach((v) => capturedVariables.add(v.value));
    }
    // Question: Should we not consider all variables in a complex clause captured?
    // const newVars = gatherDatalogVariablesFromClause(bestClause);
    // newVars.forEach((v) => capturedVariables.add(v));
  }
  return orderedClauses;
};

export const getWhereClauses = ({
  conditions,
  returnNode = DEFAULT_RETURN_NODE,
}: Omit<QueryArgs, "selections">) => {
  return conditions.length
    ? conditions.flatMap(conditionToDatalog)
    : conditionToDatalog({
        relation: "self",
        source: returnNode,
        target: returnNode,
        uid: "",
        not: false,
        type: "clause",
      });
};

const getConditionTargets = (conditions: Condition[]): string[] =>
  conditions.flatMap((c) =>
    c.type === "clause" || c.type === "not"
      ? [c.target]
      : getConditionTargets(c.conditions.flat()),
  );

export const getDatalogQuery = ({
  conditions,
  selections,
  returnNode = DEFAULT_RETURN_NODE,
  inputs = {},
}: FireQueryArgs) => {
  const expectedInputs = getConditionTargets(conditions)
    .filter((c) => /^:in /.test(c))
    .map((c) => c.substring(4))
    .filter((c) => !!inputs[c])
    .filter((value, index, array) => array.indexOf(value) === index); // Remove duplicates
  const whereClauses = optimizeQuery(
    getWhereClauses({ conditions, returnNode }),
    new Set([]),
  );

  const defaultSelections: {
    mapper: PredefinedSelection["mapper"];
    pull: string;
    label: string;
    key: string;
  }[] = [
    {
      mapper: (r) => {
        return {
          "": r?.[":node/title"] || r?.[":block/string"] || "",
          "-uid": r[":block/uid"] || "",
        };
      },
      pull: `(pull ?${returnNode} [:block/string :node/title :block/uid])`,
      label: selections.find((s) => s.text === "node")?.label || "text",
      key: "",
    },
    {
      mapper: (r) => {
        return r?.[":block/uid"] || "";
      },
      pull: `(pull ?${returnNode} [:block/uid])`,
      label: "uid",
      key: "",
    },
  ];
  const definedSelections = defaultSelections.concat(
    selections
      .map((s) => ({
        defined: predefinedSelections.find((p) => p.test.test(s.text)),
        s,
      }))
      .filter(
        (p): p is { defined: PredefinedSelection; s: Selection } => !!p.defined,
      )
      .map((p) => ({
        mapper: p.defined.mapper,
        pull: p.defined.pull({
          where: whereClauses,
          returnNode,
          match: p.defined.test.exec(p.s.text),
        }),
        label: p.s.label || p.s.text,
        key: p.s.text,
      }))
      .filter((p) => !!p.pull),
  );
  const find = definedSelections.map((p) => p.pull).join("\n  ");
  const where = whereClauses.map((c) => compileDatalog(c, 1)).join("\n");
  return {
    query: `[:find\n  ${find}\n${
      expectedInputs.length
        ? `  :in $ ${expectedInputs.map((i) => `?${i}`).join(" ")}\n`
        : ""
    }:where\n${
      whereClauses.length === 1 && whereClauses[0].type === "not-clause"
        ? `[?node :block/uid _]`
        : ""
    }${where}\n]`,
    formatResult: (result: unknown[]) =>
      definedSelections
        .map((c, i) => (prev: QueryResult) => {
          const pullResult = result[i];
          return typeof pullResult === "object" && pullResult !== null
            ? Promise.resolve(
                c.mapper(pullResult as PullBlock, c.key, prev),
              ).then((output) => ({
                output,
                label: c.label,
              }))
            : typeof pullResult === "string" || typeof pullResult === "number"
              ? Promise.resolve({ output: pullResult, label: c.label })
              : Promise.resolve({ output: "", label: c.label });
        })
        .reduce(
          (prev, c) =>
            prev.then((p) =>
              c(p).then(({ output, label }) => {
                if (typeof output === "object" && !(output instanceof Date)) {
                  Object.entries(output).forEach(([k, v]) => {
                    p[label + k] = v;
                  });
                } else if (typeof output === "number") {
                  p[label] = output.toString();
                } else {
                  p[label] = output;
                }
                return p;
              }),
            ),
          Promise.resolve({} as QueryResult),
        ),
    inputs: expectedInputs.map((i) => inputs[i]),
  };
};

export const fireQuerySync = (args: FireQueryArgs): QueryResult[] => {
  const { query } = getDatalogQuery(args);
  return (window.roamAlphaAPI.data.fast.q(query) as [PullBlock][]).map((r) => ({
    text: r[0][":node/title"] || r[0][":block/string"] || "",
    uid: r[0][":block/uid"] || "",
  }));
};

const fireQuery: FireQuery = async (_args) => {
  const { isCustomEnabled, customNode, ...args } = _args;

  const { query, formatResult, inputs } = isCustomEnabled
    ? {
        query: customNode as string,
        formatResult: (r: unknown[]): Promise<QueryResult> =>
          Promise.resolve({
            text: "",
            uid: "",
            ...Object.fromEntries(
              r.flatMap((p, index) =>
                typeof p === "object" && p !== null
                  ? Object.entries(p)
                  : [[index.toString(), p]],
              ),
            ),
          }),
        inputs: [],
      }
    : getDatalogQuery(args);
  try {
    const nodeEnv = getNodeEnv();
    const queryId = nodeEnv === "development" ? nanoid(4) : "";

    if (nodeEnv === "development") {
      console.groupCollapsed(`🔍 Roam Query - ${queryId}`);
      console.log("%c" + query, "color: #94a3b8; font-family: monospace;");
      if (inputs.length) console.log("Inputs:", ...inputs);
      console.time(`Query - ${queryId}`);
      console.groupEnd();
    }

    //@ts-ignore - todo add async q to roamjs-components
    const queryResults = await window.roamAlphaAPI.data.backend.q(
      query,
      ...inputs,
    );

    if (nodeEnv === "development") {
      console.timeEnd(`Query - ${queryId}`);
      console.groupEnd();
    }

    return Promise.all(queryResults.map(formatResult));
  } catch (e) {
    console.group("🚨 Roam Query Error");
    console.error((e as Error).message);
    console.groupEnd();
    return [];
  }
};

export default fireQuery;
