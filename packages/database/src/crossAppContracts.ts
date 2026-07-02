import type { ContentType } from "@repo/content-model";
import { Enums } from "./dbTypes";

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

// Common attributes for most types
type CrossAppBase = LocalRef & {
  createdAt: Date;
  modifiedAt?: Date;
  author: Ref;
};

type SpaceRef = DbRef | { url: string; sourceApp: Enums<"Platform"> };

export type LocalOrRemoteRef =
  | LocalRef
  | {
      localId: string;
      // infer space from context if absent.
      space?: SpaceRef;
    }
  | {
      // A string that contains combined space and localId
      rid: string;
    };

// A node schema
export type CrossAppNodeSchema = CrossAppBase & {
  label: string;
  template?: string;
  templateTitle?: string;
};

// A relation type schema
export type CrossAppRelationTypeSchema = CrossAppBase & {
  label: string;
  complement: string;
  // should we add colour? format?
};

// A relation triple schema
export type CrossAppRelationTripleSchema = CrossAppBase & {
  label: string;
  complement: string;
  relation?: Ref | CrossAppRelationTypeSchema;
  sourceType: Ref;
  destinationType: Ref;
};

// An inline vector semantic embedding
export type CrossAppEmbedding = {
  value: number[];
  embedding?: Enums<"EmbeddingName">;
};

// A Content object. It can be put inline inside a concept.
// Missing CrossAppBase attributes are inferred from enclosing object.
export type InlineCrossAppContent = Partial<CrossAppBase> & {
  value: string;
  embedding?: CrossAppEmbedding;
  scale?: Enums<"Scale">;
  contentType?: ContentType;
};

// An inline Content with obligatory typing
export type InlineCrossAppTypedContent = InlineCrossAppContent & {
  contentType: ContentType;
};

// A node instance
export type CrossAppNode = CrossAppBase & {
  nodeType: Ref;
  content: {
    direct: InlineCrossAppContent;
    full: InlineCrossAppTypedContent;
  };
};

// A relation instance
export type CrossAppRelation = CrossAppBase & {
  relationType: Ref;
  source: LocalOrRemoteRef;
  destination: LocalOrRemoteRef;
};
