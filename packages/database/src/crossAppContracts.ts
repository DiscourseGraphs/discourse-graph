import type { ContentType } from "@repo/content-model";
import { Enums, type Json } from "./dbTypes";

export type LocalRef = {
  // This localId is expected to be unique within the current space
  localId: string;
};

type DbRef = {
  // Some operations will refer to objects through their database Id
  dbId: number;
};

// Generalized reference
export type Ref = LocalRef | DbRef;

type SpaceRef = DbRef | { url: string; sourceApp: Enums<"Platform"> };

// A potentially cross-space reference
export type LocalOrRemoteRef =
  | DbRef
  | {
      localId: string;
      // Treat as LocalRef if space is absent
      space?: SpaceRef;
      // make the options mutually exclusive
      dbId?: never;
      rid?: never;
    }
  | {
      // A string that contains combined space and localId
      rid: string;
      // make the options mutually exclusive
      dbId?: never;
      localId?: never;
      space?: never;
    };

// Common attributes for most types
export type CrossAppBase = LocalRef & {
  createdAt: Date;
  modifiedAt?: Date;
  author: Ref;
};

export type CrossAppSchemaBase = CrossAppBase & {
  metadata?: Json;
};

// A node schema
export type CrossAppNodeSchema = CrossAppSchemaBase & {
  label: string;
  template?: string;
  templateTitle?: string;
};

// A relation type schema
export type CrossAppRelationTypeSchema = CrossAppSchemaBase & {
  label: string;
  complement: string;
  // should we add colour? format?
};

// A relation triple schema
export type CrossAppRelationTripleSchema = CrossAppSchemaBase &
  (
    | {
        label: string;
        complement: string;
        relation?: never;
      }
    | {
        relation: Ref;
        label?: never;
        complement?: never;
      }
  ) & {
    sourceType: Ref;
    destinationType: Ref;
  };

// An inline vector semantic embedding
export type CrossAppEmbedding = {
  value: number[];
  embedding?: Enums<"EmbeddingName">;
};

// An asset reference
export type CrossAppAsset = {
  content: ArrayBuffer;
  mimetype: string;
  createdAt: Date;
  modifiedAt?: Date;
  filepath?: string;
};

// Document fields
type CrossAppDocumentExtras = {
  // MIME type
  contentType: string;
};

// An inline document, to put inside Content or Concept.
// Currently, we fully infer Documents (setting content_as_document=true)
// since our nodes are pages; so this is not used yet.
export type InlineCrossAppDocument = Partial<CrossAppBase> &
  CrossAppDocumentExtras;

// A standalone document, for `upsert_documents`. Not currently used.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type StandaloneCrossAppDocument = LocalRef &
  CrossAppBase &
  CrossAppDocumentExtras;

// Content fields
type CrossAppContentExtras = {
  value: string;
  embedding?: CrossAppEmbedding;
  scale?: Enums<"Scale">;
  partOf?: Ref;
  assets?: CrossAppAsset[];
  document?: InlineCrossAppDocument;
  contentType?: ContentType;
};

// A Content object. It can be put inline inside a concept.
// Missing CrossAppBase attributes are inferred from enclosing object.
export type InlineCrossAppContent = Partial<CrossAppBase> &
  CrossAppContentExtras;

// A standalone content object, for `upsert_content`
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type StandaloneCrossAppContent = LocalRef &
  CrossAppBase &
  CrossAppContentExtras;

// An inline Content with obligatory typing
type InlineCrossAppTypedContent = InlineCrossAppContent & {
  contentType: ContentType;
};

// A platform account
// either standalone for `upsert_account_in_space`,
// or inline in Content or Concept
export type CrossAppAccount = {
  accountLocalId: string;
  name?: string;
  email?: string;
  // agentType: Enums<"AgentType"> = 'person'  // inferred
  // dgAccount?: string; // uuid
};

// A node instance
export type CrossAppNode = CrossAppBase & {
  nodeType: Ref;
  content: {
    direct: InlineCrossAppContent;
    full: InlineCrossAppTypedContent;
  };
  // This is a way to define document globally for all contents
  document?: InlineCrossAppDocument;
};

// A relation instance
export type CrossAppRelation = CrossAppBase & {
  relationType: Ref;
  source: LocalOrRemoteRef;
  destination: LocalOrRemoteRef;
};
