export type DiscourseNode = {
  name: string;
  format: string;
  shortcut?: string;
  color?: string;
};

export type DiscourseRelationType = {
  id: string;
  label: string;
  complement: string;
};

export type DiscourseRelation = {
  source: DiscourseNode;
  destination: DiscourseNode;
  relationshipType: DiscourseRelationType;
};

export type Settings = {
  nodeTypes: DiscourseNode[];
  discourseRelations: DiscourseRelation[];
  relationTypes: DiscourseRelationType[];
};
