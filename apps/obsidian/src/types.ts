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
  created: number;
  modified: number;
  importedFromRid?: string;
};

export type DiscourseRelationType = {
  id: string;
  label: string;
  complement: string;
  color: TldrawColorName;
  created: number;
  modified: number;
  importedFromRid?: string;
};

export type DiscourseRelation = {
  id: string;
  sourceId: string;
  destinationId: string;
  relationshipTypeId: string;
  created: number;
  modified: number;
  importedFromRid?: string;
};

export type RelationInstance = {
  id: string;
  type: string;
  source: string;
  destination: string;
  created: number;
  author: string;
  lastModified?: number;
  publishedToGroupId?: string[];
  importedFromRid?: string;
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

export type ImportableNode = {
  nodeInstanceId: string;
  title: string;
  spaceId: number;
  spaceName: string;
  groupId: string;
  selected: boolean;
  /** From source Content (latest last_modified across variants). Set when loaded from getPublishedNodesForGroups. */
  createdAt?: number;
  modifiedAt?: number;
  filePath?: string;
};

export type GroupWithNodes = {
  groupId: string;
  groupName?: string;
  nodes: ImportableNode[];
};

export const VIEW_TYPE_DISCOURSE_CONTEXT = "discourse-context-view";
