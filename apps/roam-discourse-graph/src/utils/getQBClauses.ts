import { Condition, QBClauseData } from "./types";

const getQBClauses = (cs: Condition[]): QBClauseData[] =>
  cs.flatMap((c) => {
    switch (c.type) {
      case "not or":
      case "or":
        return getQBClauses(c.conditions.flat());
      case "clause":
      case "not":
      default:
        return c;
    }
  });

export default getQBClauses;
