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
  folderPath?: string;
  created: number;
  modified: number;
  importedFromRid?: string;
  authorId?: number;
};

export type ImportStatus = "provisional" | "accepted";

export type DiscourseRelationType = {
  id: string;
  label: string;
  complement: string;
  color: TldrawColorName;
  created: number;
  modified: number;
  importedFromRid?: string;
  status?: ImportStatus;
  authorId?: number;
};

export type DiscourseRelation = {
  id: string;
  sourceId: string;
  destinationId: string;
  relationshipTypeId: string;
  created: number;
  modified: number;
  importedFromRid?: string;
  status?: ImportStatus;
  authorId?: number;
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
  /** Tracks acceptance of imported relations. false = imported, not yet accepted. true or undefined = accepted/local. */
  tentative?: boolean;
  authorId?: number;
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
  /** Maps spaceUri (e.g. "obsidian:abc123") to human-readable name (e.g. "My Vault") */
  spaceNames?: Record<string, string>;
  username?: string;
  userNames?: Record<number, string>;
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
  authorId?: number;
};

export type GroupWithNodes = {
  groupId: string;
  groupName?: string;
  nodes: ImportableNode[];
  authorIds: Set<number>;
};

export const VIEW_TYPE_DISCOURSE_CONTEXT = "discourse-context-view";
