import { DatalogClause } from "roamjs-components/types/native";

const gatherDatalogVariablesFromClause = (
  clause: DatalogClause,
): Set<string> => {
  if (
    clause.type === "data-pattern" ||
    clause.type === "fn-expr" ||
    clause.type === "pred-expr" ||
    clause.type === "rule-expr"
  ) {
    return new Set(
      [...clause.arguments]
        .filter((v) => v.type === "variable")
        .map((v) => v.value),
    );
  } else if (
    clause.type === "not-clause" ||
    clause.type === "or-clause" ||
    clause.type === "and-clause"
  ) {
    return new Set(
      clause.clauses.flatMap((c) =>
        Array.from(gatherDatalogVariablesFromClause(c)),
      ),
    );
  } else if (
    clause.type === "not-join-clause" ||
    clause.type === "or-join-clause"
  ) {
    return new Set(clause.variables.map((c) => c.value));
  }
  return new Set();
};

export default gatherDatalogVariablesFromClause;
