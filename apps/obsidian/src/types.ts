export type DiscourseNode = {
  id: string;
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
  sourceId: string;
  destinationId: string;
  relationshipTypeId: string;
};

export type Settings = {
  nodeTypes: DiscourseNode[];
  discourseRelations: DiscourseRelation[];
  relationTypes: DiscourseRelationType[];
};
