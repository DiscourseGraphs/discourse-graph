import type {
  InputTextNode,
} from "roamjs-components/types/native";

// ===========================================
// QUERY BUILDER TYPES (moved from utils/types.ts)
// ===========================================

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

export type Result = {
  text: string;
  uid: string;
} & Record<`${string}-uid`, string> &
  Record<string, string | number | Date>;

export type Column = { key: string; uid: string; selection: string };

export type ExportTypes = {
  name: string;
  callback: (args: {
    filename: string;
    includeDiscourseContext: boolean;
    isExportDiscourseGraph: boolean;
  }) => Promise<{ title: string; content: string }[]>;
}[];

// ===========================================
// DISCOURSE TYPES (moved from utils/getDiscourseNodes.ts and getDiscourseRelations.ts)
// ===========================================

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

// ===========================================
// QUERY TYPES (moved from utils/fireQuery.ts)
// ===========================================

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