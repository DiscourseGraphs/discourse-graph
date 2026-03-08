import type { DatalogAndClause, DatalogClause } from "roamjs-components/types";

const getLegacyCanvasLookupClauses = ({
  target,
}: {
  target: string;
}): DatalogClause[] =>
  [
    {
      type: "fn-expr",
      fn: "get",
      arguments: [
        { type: "variable", value: `${target}-Canvas-RQB` },
        { type: "constant", value: ":tldraw" },
      ],
      binding: {
        type: "bind-rel",
        args: [
          { type: "variable", value: `${target}-TLDraw-Key` },
          { type: "variable", value: `${target}-TLDraw-Value` },
        ],
      },
    },
  ] as DatalogClause[];

// tldraw 2.x schema
const getCanvas2LookupClauses = ({
  target,
}: {
  target: string;
}): DatalogClause[] =>
  [
    {
      type: "fn-expr",
      fn: "get",
      arguments: [
        { type: "variable", value: `${target}-Canvas-RQB` },
        { type: "constant", value: ":tldraw" },
      ],
      binding: {
        type: "bind-scalar",
        variable: { type: "variable", value: `${target}-TLDraw` },
      },
    },
    {
      type: "fn-expr",
      fn: "get",
      arguments: [
        { type: "variable", value: `${target}-TLDraw` },
        { type: "constant", value: ":store" },
      ],
      binding: {
        type: "bind-rel",
        args: [
          { type: "variable", value: `${target}-TLDraw-Key` },
          { type: "variable", value: `${target}-TLDraw-Value` },
        ],
      },
    },
  ] as DatalogClause[];

export const getCanvasMembershipShapeClauses = ({
  source,
  target,
}: {
  source: string;
  target: string;
}): DatalogClause[] => {
  const sourceUidVar = `${source}-uid`;
  const canvasRqbVar = `${target}-Canvas-RQB`;
  const tldrawValueVar = `${target}-TLDraw-Value`;
  const shapePropsVar = `${target}-Shape-Props`;

  return [
    {
      type: "or-join-clause",
      variables: [
        { type: "variable", value: canvasRqbVar },
        { type: "variable", value: tldrawValueVar },
      ],
      clauses: [
        {
          type: "and-clause",
          clauses: getLegacyCanvasLookupClauses({ target }),
        } as DatalogAndClause,
        {
          type: "and-clause",
          clauses: getCanvas2LookupClauses({ target }),
        } as DatalogAndClause,
      ],
    } as DatalogClause,
    {
      type: "fn-expr",
      fn: "get",
      arguments: [
        { type: "variable", value: tldrawValueVar },
        { type: "constant", value: ":props" },
      ],
      binding: {
        type: "bind-scalar",
        variable: { type: "variable", value: shapePropsVar },
      },
    } as DatalogClause,
    {
      type: "fn-expr",
      fn: "get",
      arguments: [
        { type: "variable", value: shapePropsVar },
        { type: "constant", value: ":uid" },
      ],
      binding: {
        type: "bind-scalar",
        variable: { type: "variable", value: sourceUidVar },
      },
    } as DatalogClause,
  ];
};
