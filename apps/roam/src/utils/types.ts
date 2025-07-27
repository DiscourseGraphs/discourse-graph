import type { InputTextNode } from "roamjs-components/types/native";

type QBBase = {
  uid: string;
};
export type QBClauseData = {
  relation: string;
  source: string;
  target: string;
  not?: boolean;
} & QBBase;
export type QBNestedData = {
  conditions: Condition[][];
} & QBBase;
export type QBClause = QBClauseData & {
  type: "clause";
};
export type QBNot = QBClauseData & {
  type: "not";
};
export type QBOr = QBNestedData & {
  type: "or";
};
export type QBNor = QBNestedData & {
  type: "not or";
};
export type Condition = QBClause | QBNot | QBOr | QBNor;

export type Selection = {
  text: string;
  label: string;
  uid: string;
};

export type ExportTypes = {
  name: string;
  callback: (args: {
    filename: string;
    includeDiscourseContext: boolean;
    isExportDiscourseGraph: boolean;
  }) => Promise<{ title: string; content: string }[]>;
}[];

export type Result = {
  text: string;
  uid: string;
} & Record<`${string}-uid`, string> &
  Record<string, string | number | Date>;

export type Column = { key: string; uid: string; selection: string };

export type Triple = readonly [string, string, string];

export type DiscourseRelation = {
  triples: Triple[];
  id: string;
  label: string;
  source: string;
  destination: string;
  complement: string;
};

export type DiscourseNode = {
  text: string;
  type: string;
  shortcut: string;
  specification: Condition[];
  backedBy: "user" | "default" | "relation";
  canvasSettings: {
    [k: string]: string;
  };
  // @deprecated - use specification instead
  format: string;
  graphOverview?: boolean;
  description?: string;
  template?: InputTextNode[];
};
