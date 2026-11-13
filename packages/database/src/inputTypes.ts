import type { Tables, Database } from "@repo/database/dbTypes";

export type LocalAccountDataInput = Partial<
  Database["public"]["CompositeTypes"]["account_local_input"]
>;
export type LocalDocumentDataInput = Partial<
  Omit<
    Database["public"]["CompositeTypes"]["document_local_input"],
    "author_inline" | "contents"
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
  Omit<
    Database["public"]["CompositeTypes"]["concept_local_input"],
    "document_inline" | "author_inline" | "creator_inline" | "contents_inline"
  > & {
    document_inline: LocalDocumentDataInput;
    author_inline: LocalAccountDataInput;
    creator_inline: LocalAccountDataInput;
    contents_inline: LocalContentDataInput[];
  }
>;

type PublicRelations = Database["public"]["Tables"] &
  Database["public"]["Views"];

/**
 * A table or view row with its columns only, as `select("*")` returns it.
 * Computed fields are omitted: generated `Row` types include them, and type
 * bug marks a `SETOF` field as a single object.
 */
export type ColumnRow<T extends keyof PublicRelations> = Omit<
  Tables<T>,
  PublicRelations[T]["ComputedFields"]
>;
