import type {
  DatalogArgument,
  DatalogBinding,
  DatalogClause,
} from "roamjs-components/types/native";

const indent = (n: number) => "".padStart(n * 2, " ");

export const toVar = (v = "undefined") =>
  v.replace(/[\s"()[\]{}/\\^@,~`]/g, "");

const compileDatalog = (
  d: DatalogClause | DatalogArgument | DatalogBinding,
  level = 0,
): string => {
  switch (d.type) {
    case "data-pattern":
      return `${indent(level)}[${
        d.srcVar ? `${compileDatalog(d.srcVar, level)} ` : ""
      }${(d.arguments || []).map((a) => compileDatalog(a, level)).join(" ")}]`;
    case "src-var":
      return `$${toVar(d.value)}`;
    case "constant":
    case "underscore":
      return d.value || "_";
    case "variable":
      return `?${toVar(d.value)}`;
    case "fn-expr":
      return `${indent(level)}[(${d.fn} ${(d.arguments || [])
        .map((a) => compileDatalog(a, level))
        .join(" ")}) ${compileDatalog(d.binding, level)}]`;
    case "pred-expr":
      return `${indent(level)}[(${d.pred} ${(d.arguments || [])
        .map((a) => compileDatalog(a, level))
        .join(" ")})]`;
    case "rule-expr":
      return `[${d.srcVar ? `${compileDatalog(d.srcVar, level)} ` : ""}${(
        d.arguments || []
      )
        .map((a) => compileDatalog(a, level))
        .join(" ")}]`;
    case "not-clause":
      return `${indent(level)}(${
        d.srcVar ? `${compileDatalog(d.srcVar, level)} ` : ""
      }not\n${(d.clauses || [])
        .map((a) => compileDatalog(a, level + 1))
        .join(" ")}\n${indent(level)})`;
    case "or-clause":
      return `${indent(level)}(${
        d.srcVar ? `${compileDatalog(d.srcVar, level)} ` : ""
      }or ${(d.clauses || [])
        .map((a) => compileDatalog(a, level + 1))
        .join("\n")})`;
    case "and-clause":
      return `${indent(level)}(and\n${(d.clauses || [])
        .map((c) => compileDatalog(c, level + 1))
        .join("\n")}\n${indent(level)})`;
    case "not-join-clause":
      return `${indent(level)}(${
        d.srcVar ? `${compileDatalog(d.srcVar, level)} ` : ""
      }not-join [${(d.variables || [])
        .map((v) => compileDatalog(v, level))
        .join(" ")}] ${(d.clauses || [])
        .map((a) => compileDatalog(a, level + 1))
        .join(" ")})`;
    case "or-join-clause":
      return `${indent(level)}(${
        d.srcVar ? `${compileDatalog(d.srcVar, level)} ` : ""
      }or-join [${(d.variables || [])
        .map((v) => compileDatalog(v, level))
        .join(" ")}]\n${(d.clauses || [])
        .map((a) => compileDatalog(a, level + 1))
        .join("\n")})`;
    case "bind-scalar":
      if (!d.variable) return "";
      return compileDatalog(d.variable, level);
    case "bind-rel":
      return `[[${d.args.map((a) => compileDatalog(a, level)).join(" ")}]]`;
    default:
      return "";
  }
};

export default compileDatalog;
