import type {
  DatalogClause,
  DatalogVariable,
} from "roamjs-components/types/native";

const replaceDatalogVariables = (
  replacements: (
    | { from: string; to: string }
    | { from: true; to: (v: string) => string }
  )[] = [],
  clauses: DatalogClause[],
): DatalogClause[] => {
  const replaceDatalogVariable = (a: DatalogVariable): DatalogVariable => {
    const rep = replacements.find(
      (rep) => a.value === rep.from || rep.from === true,
    );
    if (!rep) {
      return { ...a };
    } else if (a.value === rep.from) {
      a.value = rep.to;
      return {
        ...a,
        value: rep.to,
      };
    } else if (rep.from === true) {
      return {
        ...a,
        value: rep.to(a.value),
      };
    }
    return a;
  };
  return clauses.map((c): DatalogClause => {
    switch (c.type) {
      case "data-pattern":
      case "fn-expr":
      case "pred-expr":
      case "rule-expr":
        return {
          ...c,
          arguments: c.arguments.map((a) => {
            if (a.type !== "variable") {
              return { ...a };
            }
            return replaceDatalogVariable(a);
          }),
          ...(c.type === "fn-expr"
            ? {
                binding:
                  c.binding.type === "bind-scalar"
                    ? {
                        variable: replaceDatalogVariable(c.binding.variable),
                        type: "bind-scalar",
                      }
                    : c.binding,
              }
            : {}),
        };
      case "not-join-clause":
      case "or-join-clause":
        return {
          ...c,
          variables: c.variables.map(replaceDatalogVariable),
          clauses: replaceDatalogVariables(replacements, c.clauses),
        };
      case "not-clause":
      case "or-clause":
      case "and-clause":
        return {
          ...c,
          clauses: replaceDatalogVariables(replacements, c.clauses),
        };
      default:
        throw new Error(`Unknown clause type: ${c["type"]}`);
    }
  });
};

export default replaceDatalogVariables;
