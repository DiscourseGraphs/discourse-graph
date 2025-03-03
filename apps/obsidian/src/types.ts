export type DiscourseNodeType = {
  name: string;
  format: string;
  shortcut?: string;
  color?: string;
};

export type Settings = {
  nodeTypes: DiscourseNodeType[];
};
