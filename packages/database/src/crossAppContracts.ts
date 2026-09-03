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

// An asset (an image or attachment) that a node's full content references.
export type CrossAppAsset = {
  // What the node's full content refers to, exactly as it wrote it: a path on a
  // platform that addresses assets by path, a URL on one that addresses them by URL.
  // Publication never rewrites it, so this is what a destination matches on, and it
  // is unique within one node's `assets`: it maps to `FileReference.filepath`, which
  // is part of that table's primary key.
  sourceRef: string;
  // The SHA-256 of the stored bytes as 64 lowercase hex characters, which is also
  // their object name in shared storage. A destination looks the bytes up by this
  // string exactly, so any other encoding fails as a not-found rather than a type error.
  // Required: an asset whose bytes were not stored is represented by its absence
  // from `assets`, not by an entry with nothing to resolve. Its `sourceRef` stays in
  // the content, and the failure is reported by whichever transfer hit it.
  contentHash: string;
  // Where the source kept the asset: a name on a platform with a flat asset namespace,
  // a path on one with folders. A destination derives the name and placement of its
  // local copy by decomposing this as a path, and a bare name decomposes to itself.
  // Absent when the source recorded nothing beyond `sourceRef`.
  sourcePath?: string;
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
  // The assets referenced by `content.full` whose bytes are stored. An asset that
  // could not be stored is not listed: a destination leaves its token untouched,
  // which is the same thing it does for a link that was never an asset.
  assets?: CrossAppAsset[];
};

// A relation instance
export type CrossAppRelation = CrossAppBase & {
  relationType: LocalId;
  /* eslint-disable @typescript-eslint/no-duplicate-type-constituents */
  source: LocalId | Rid;
  destination: LocalId | Rid;
  /* eslint-enable @typescript-eslint/no-duplicate-type-constituents */
};
