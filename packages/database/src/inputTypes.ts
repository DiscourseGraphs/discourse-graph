import type { Database, TablesInsert } from "@repo/database/dbTypes";

export type LocalAccountDataInput = Partial<
  Database["public"]["CompositeTypes"]["account_local_input"]
>;
export type LocalDocumentDataInput = Partial<
  Omit<
    Database["public"]["CompositeTypes"]["document_local_input"],
    "author_inline"
  > & { author_inline: LocalAccountDataInput }
>;
export type LocalContentDataInput = Partial<
  Omit<
    Database["public"]["CompositeTypes"]["content_local_input"],
    "document_inline" | "author_inline" | "creator_inline"
  > & {
    document_inline: LocalDocumentDataInput;
    author_inline: LocalAccountDataInput;
    creator_inline: LocalAccountDataInput;
  }
>;
export type LocalConceptDataInput = Partial<
  Database["public"]["CompositeTypes"]["concept_local_input"]
>;
