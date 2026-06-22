import { describe, expect, it } from "vitest";
import compileDatalog, { toVar } from "~/utils/compileDatalog";
import gatherDatalogVariablesFromClause from "~/utils/gatherDatalogVariablesFromClause";
import replaceDatalogVariables from "~/utils/replaceDatalogVariables";

describe("compileDatalog", () => {
  it("sanitizes variable names", () => {
    expect(toVar('a b"(c)')).toBe("abc");
  });

  it("compiles nested and-clauses", () => {
    const query = compileDatalog({
      type: "and-clause",
      clauses: [
        {
          type: "data-pattern",
          arguments: [
            { type: "variable", value: "node" },
            { type: "constant", value: ":node/title" },
            { type: "constant", value: '"Hello"' },
          ],
        },
        {
          type: "pred-expr",
          pred: "=",
          arguments: [
            { type: "variable", value: "node" },
            { type: "variable", value: "match" },
          ],
        },
      ],
    });

    expect(query).toContain("(and");
    expect(query).toContain('[?node :node/title "Hello"]');
    expect(query).toContain("[(= ?node ?match)]");
  });
});

describe("gatherDatalogVariablesFromClause", () => {
  it("collects variables from nested clauses", () => {
    const variables = gatherDatalogVariablesFromClause({
      type: "and-clause",
      clauses: [
        {
          type: "data-pattern",
          arguments: [
            { type: "variable", value: "a" },
            { type: "constant", value: ":rel" },
            { type: "variable", value: "b" },
          ],
        },
        {
          type: "or-join-clause",
          variables: [
            { type: "variable", value: "c" },
            { type: "variable", value: "d" },
          ],
          clauses: [],
        },
      ],
    });

    expect(Array.from(variables).sort()).toEqual(["a", "b", "c", "d"]);
  });
});

describe("replaceDatalogVariables", () => {
  it("replaces explicit variable names and function bindings", () => {
    const [clause] = replaceDatalogVariables(
      [{ from: "node", to: "page" }],
      [
        {
          type: "fn-expr",
          fn: "identity",
          arguments: [{ type: "variable", value: "node" }],
          binding: {
            type: "bind-scalar",
            variable: { type: "variable", value: "node" },
          },
        },
      ],
    );

    expect(clause.type).toBe("fn-expr");
    if (clause.type !== "fn-expr") return;
    expect(clause.arguments[0]).toMatchObject({ value: "page" });
    expect(clause.binding).toMatchObject({
      variable: { value: "page" },
    });
  });

  it("supports transform replacement for all variables", () => {
    const [clause] = replaceDatalogVariables(
      [{ from: true, to: (v) => `${v}-v2` }],
      [
        {
          type: "not-join-clause",
          variables: [{ type: "variable", value: "a" }],
          clauses: [
            {
              type: "data-pattern",
              arguments: [
                { type: "variable", value: "a" },
                { type: "constant", value: ":x" },
                { type: "variable", value: "b" },
              ],
            },
          ],
        },
      ],
    );

    expect(clause.type).toBe("not-join-clause");
    if (clause.type !== "not-join-clause") return;
    expect(clause.variables[0].value).toBe("a-v2");
    expect(clause.clauses[0]).toMatchObject({
      arguments: [{ value: "a-v2" }, { value: ":x" }, { value: "b-v2" }],
    });
  });
});
