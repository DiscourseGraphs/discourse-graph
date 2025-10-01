import { TFile } from "obsidian";

export type DiscourseNode = {
  id: string;
  name: string;
  format: string;
  template?: string;
  description?: string;
  shortcut?: string;
  color?: string;
  tag?: string;
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
  showIdsInFrontmatter: boolean;
  nodesFolderPath: string;
};

export type BulkImportCandidate = {
  file: TFile;
  matchedNodeType: DiscourseNode;
  alternativePattern: string;
  extractedContent: string;
  selected: boolean;
};

export type BulkImportPattern = {
  nodeTypeId: string;
  alternativePattern: string;
  enabled: boolean;
};

export const VIEW_TYPE_DISCOURSE_CONTEXT = "discourse-context-view";
