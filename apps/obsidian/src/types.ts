export type DiscourseNode = {
  name: string;
  format: string;
  shortcut?: string;
  color?: string;
};

export type Settings = {
  nodeTypes: DiscourseNode[];
};
