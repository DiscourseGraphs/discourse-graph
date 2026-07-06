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
export type CrossAppBase = LocalRef & {
  createdAt: Date;
  modifiedAt?: Date;
  author: Ref;
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
type InlineCrossAppTypedContent = InlineCrossAppContent & {
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
