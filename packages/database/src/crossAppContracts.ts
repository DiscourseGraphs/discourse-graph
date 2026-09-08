import type { ContentType } from "@repo/content-model";
import { Enums, type Json } from "./dbTypes";

// An identifier for objects in the platform. Expected to be unique within the platform.
export type LocalId = string;

// A composite identifier for objects in other spaces.
export type Rid = string;

// Common attributes for most types
export type CrossAppBase = {
  localId: LocalId;
  rid?: string;
  createdAt: Date;
  modifiedAt?: Date;
  authorId: LocalId;
};

export type CrossAppSchemaBase = CrossAppBase & {
  metadata?: Json;
};

// A node schema
export type CrossAppNodeSchema = CrossAppSchemaBase & {
  label: string;
  template?: string;
  templateTitle?: string;
  format?: string;
  slotDefinitions?: Record<string, LocalId | undefined>;
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
        relation: LocalId;
        label?: never;
        complement?: never;
      }
  ) & {
    sourceType: LocalId;
    destinationType: LocalId;
  };

// An inline vector semantic embedding
export type CrossAppEmbedding = {
  value: number[];
  embedding?: Enums<"EmbeddingName">;
};

// An inline document, to put inside Content (or Concept)
export type CrossAppDocument = CrossAppBase & {
  // MIME type
  contentType: string;
};

// A Content object. It can be put inline inside a concept.
// Missing CrossAppBase attributes are inferred from enclosing object.
export type InlineCrossAppContent = Partial<CrossAppBase> & {
  value: string;
  embedding?: CrossAppEmbedding;
  scale?: Enums<"Scale">;
  partOf?: LocalId;
  document?: LocalId;
  contentType?: ContentType;
};

// An inline Content with obligatory typing
type InlineCrossAppTypedContent = InlineCrossAppContent & {
  contentType: ContentType;
};

// A node instance
export type CrossAppNode = CrossAppBase & {
  nodeType: LocalId;
  // The title stripped of the node type's title format ("[[CLM]] - {content}"
  // -> the {content} part). Equals the title when the type has no format or
  // the title does not match it.
  coreTitle: string;
  slots?: Record<string, LocalId>;
  content: {
    direct: InlineCrossAppContent;
    full?: InlineCrossAppTypedContent;
  };
  // This is a way to define document globally for all contents
  document?: LocalId;
};

// A relation instance
export type CrossAppRelation = CrossAppBase & {
  relationType: LocalId;
  /* eslint-disable @typescript-eslint/no-duplicate-type-constituents */
  source: LocalId | Rid;
  destination: LocalId | Rid;
  /* eslint-enable @typescript-eslint/no-duplicate-type-constituents */
};
