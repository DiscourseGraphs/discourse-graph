import type { ContentType } from "@repo/content-model";
import type { Enums, Json } from "./dbTypes.js";
import type { LocalContentDataInput } from "./inputTypes.js";

export type ContentRepresentation = {
  variant: Enums<"ContentVariant">;
  contentType: ContentType;
};

export type ContentResolveRequest = {
  sourceLocalIds: string[];
  representations: ContentRepresentation[];
};

export type ResolvedContent = ContentRepresentation & {
  sourceLocalId: string;
  text: string | null;
  metadata: Json;
  created: string | null;
  lastModified: string | null;
  authorId: number | null;
};

export type ContentUpsertRequest = {
  content: LocalContentDataInput[];
  contentAsDocument?: boolean;
};

export type ContentUpsertResponse = {
  ids: number[];
};
