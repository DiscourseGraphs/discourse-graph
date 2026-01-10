import { TFile } from "obsidian";
import { TldrawColorName } from "./utils/tldrawColors";

export type DiscourseNode = {
  id: string;
  name: string;
  format: string;
  template?: string;
  description?: string;
  shortcut?: string;
  color?: string;
  tag?: string;
  keyImage?: boolean;
};

export type DiscourseRelationType = {
  id: string;
  label: string;
  complement: string;
  color: TldrawColorName;
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
  canvasFolderPath: string;
  canvasAttachmentsFolderPath: string;
  nodeTagHotkey: string;
  spacePassword?: string;
  accountLocalId?: string;
  syncModeEnabled?: boolean;
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
